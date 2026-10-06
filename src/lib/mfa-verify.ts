import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-side TOTP checks shared by the 2FA settings, the sign-in code step and withdrawals.

export const CODE_PATTERN = /^\d{6}$/;

// Supabase already throttles MFA verification per IP; on top of that, cap
// guesses per account across all IPs and per account+IP, so a 6-digit code
// can't be brute-forced from many addresses.
export async function attemptAllowed(_supabase: SupabaseClient, userId: string) {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: `mfa-verify-user:${userId}`,
    p_max_attempts: 10,
    p_window_seconds: 900,
  });
  if (!error && data === false) return false;
  return checkRateLimit(`mfa-verify:${userId}`, 5, 300);
}

// Maps a Supabase verify error to a TwoFactor message key. A wrong code and
// one whose 30-second window has passed are indistinguishable to Supabase
// (both "mfa_verification_failed"), so one message covers both.
export function verifyErrorKey(error: AuthError) {
  switch (error.code) {
    case "mfa_verification_failed":
    case "mfa_verification_rejected":
      return "errCodeInvalid";
    case "mfa_challenge_expired":
      return "errChallengeExpired";
    case "mfa_factor_not_found":
      return "errEnrollmentExpired";
    case "over_request_rate_limit":
      return "errTooManyAttempts";
    default:
      return error.status === 429 ? "errTooManyAttempts" : "errGeneric";
  }
}

export function readCode(formData: FormData) {
  return ((formData.get("code") as string) ?? "").replace(/\s/g, "");
}

export async function verifiedTotpFactorId(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp[0]?.id ?? null;
}
