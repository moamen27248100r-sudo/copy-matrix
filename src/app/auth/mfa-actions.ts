"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/safe-next";

// Two-factor authentication via Supabase Auth's built-in TOTP MFA. Supabase
// generates the secret, checks every code and stamps aal2 on the session;
// these actions only drive its enroll / challenge / verify / unenroll calls.

export type MfaFormState = { error?: string; ok?: boolean };
export type TotpEnrollment = { factorId: string; qrCode: string; secret: string; uri: string };

const CODE_PATTERN = /^\d{6}$/;

// Supabase already throttles MFA verification per IP; on top of that, cap
// guesses per account across all IPs and per account+IP, so a 6-digit code
// can't be brute-forced from many addresses.
async function attemptAllowed(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("check_rate_limit", {
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
function verifyErrorKey(error: AuthError) {
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

function readCode(formData: FormData) {
  return ((formData.get("code") as string) ?? "").replace(/\s/g, "");
}

async function verifiedTotpFactorId(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp[0]?.id ?? null;
}

// Sign-in step two: steps the current aal1 session up to aal2.
export async function verifyMfaLogin(_prev: MfaFormState, formData: FormData): Promise<MfaFormState> {
  const t = await getTranslations("TwoFactor");
  const code = readCode(formData);
  const next = safeNextPath(formData.get("next") as string);

  if (!CODE_PATTERN.test(code)) return { error: t("errCodeFormat") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await attemptAllowed(supabase, user.id))) return { error: t("errTooManyAttempts") };

  const factorId = await verifiedTotpFactorId(supabase);
  if (!factorId) redirect(next ?? "/dashboard");

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: t(verifyErrorKey(error)) };

  redirect(next ?? "/dashboard");
}

// Creates a fresh (unverified) TOTP factor and returns its QR code + secret.
// Any half-finished earlier attempt is discarded first so they never pile up.
export async function startTotpEnrollment(): Promise<TotpEnrollment | { error: string }> {
  const t = await getTranslations("TwoFactor");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsecurity");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.length) return { error: t("errAlreadyEnabled") };
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Copy Matrix",
    friendlyName: "Authenticator app",
  });
  if (error || !data) return { error: t("errGeneric") };

  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

// First valid code from the app verifies the new factor (and upgrades this
// session to aal2), which is what turns 2FA on.
export async function confirmTotpEnrollment(_prev: MfaFormState, formData: FormData): Promise<MfaFormState> {
  const t = await getTranslations("TwoFactor");
  const code = readCode(formData);
  const factorId = (formData.get("factorId") as string) ?? "";

  if (!CODE_PATTERN.test(code)) return { error: t("errCodeFormat") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsecurity");

  if (!(await attemptAllowed(supabase, user.id))) return { error: t("errTooManyAttempts") };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: t(verifyErrorKey(error)) };

  revalidatePath("/account/security");
  return { ok: true };
}

// Turning 2FA off needs a currently valid code, not just a signed-in session.
export async function disableTotp(_prev: MfaFormState, formData: FormData): Promise<MfaFormState> {
  const t = await getTranslations("TwoFactor");
  const code = readCode(formData);

  if (!CODE_PATTERN.test(code)) return { error: t("errCodeFormat") };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsecurity");

  if (!(await attemptAllowed(supabase, user.id))) return { error: t("errTooManyAttempts") };

  const factorId = await verifiedTotpFactorId(supabase);
  if (!factorId) return { error: t("errNotEnabled") };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: t(verifyErrorKey(error)) };

  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
  if (unenrollError) return { error: t("errGeneric") };

  revalidatePath("/account/security");
  return { ok: true };
}
