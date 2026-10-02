import type { SupabaseClient, User } from "@supabase/supabase-js";

// Two-factor authentication rides entirely on Supabase Auth's built-in MFA
// (TOTP factors + the JWT's `aal` claim) -- nothing here stores secrets or
// checks codes itself. These helpers only answer "does this signed-in
// session still owe a second factor?", shared by the proxy (server-side
// gate), the sign-in actions and the /login/mfa page so all three agree.

export const MFA_CHALLENGE_PATH = "/login/mfa";
// Set by the password login when it hands off to the code step, so the
// login is recorded (record_login) once the code is accepted.
export const MFA_PENDING_LOGIN_COOKIE = "cm_mfa_login";

export function hasVerifiedTotp(user: Pick<User, "factors">): boolean {
  return (user.factors ?? []).some((f) => f.factor_type === "totp" && f.status === "verified");
}

// Reads the claims of a JWT that Supabase has already validated (the access
// token getUser() just used) -- decoding only, no signature check needed.
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// True when `user` (fresh from getUser(), so its factor list is current) has
// a verified TOTP factor but the session hasn't been stepped up to aal2 yet.
export async function getPendingMfa(supabase: SupabaseClient, user: User): Promise<{ pending: boolean }> {
  if (!hasVerifiedTotp(user)) return { pending: false };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claims = session ? decodeJwtClaims(session.access_token) : null;
  return { pending: claims?.aal !== "aal2" };
}
