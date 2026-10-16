import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Limits that follow the e-mail address, not only the network address: someone who guesses one
// customer's password from many addresses, or who floods sign-up and password reset for one
// address, is stopped by the address itself. Keys are hashed, so no e-mail sits in rate_limits.

export const normalizeEmail = (raw: string): string => raw.trim().toLowerCase();

const keyOf = (kind: string, email: string) => `${kind}:${createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32)}`;

const FAIL_MAX = 5;
const FAIL_WINDOW = 15 * 60;

/** Sign-in is paused for an address after 5 wrong passwords in 15 minutes. */
export async function loginBlocked(email: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("rate_limit_blocked", { p_key: keyOf("login-fail", email), p_max: FAIL_MAX, p_window_seconds: FAIL_WINDOW });
  return !error && data === true;
}
export async function recordLoginFailure(email: string) {
  await createAdminClient().rpc("rate_limit_record", { p_key: keyOf("login-fail", email) });
}
export async function clearLoginFailures(email: string) {
  await createAdminClient().rpc("rate_limit_clear", { p_key: keyOf("login-fail", email) });
}

/** At most `max` tries per address and kind (sign-up, reset, verification mail) in the window. */
export async function emailActionAllowed(kind: string, email: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", { p_key: keyOf(kind, email), p_max_attempts: max, p_window_seconds: windowSeconds });
  if (error) return true;
  return data === true;
}
