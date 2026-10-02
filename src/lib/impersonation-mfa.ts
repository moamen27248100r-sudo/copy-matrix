// An admin "view as user" session is minted from a magic link, so it is
// only ever aal1 -- for a customer with 2FA on, the proxy's aal2 gate would
// lock the admin out of the very account they're inspecting. impersonateUser
// therefore drops a cookie holding an HMAC of (target user id, session id)
// keyed with the server-only secret: the proxy lets that one aal1 session
// through, and nobody without SUPABASE_SECRET_KEY can forge it for any other
// session (a fresh login gets a new session id, so a stale cookie is inert).
export const IMPERSONATION_MFA_COOKIE = "cm_impersonator_mfa";

export async function impersonationMfaSignature(userId: string, sessionId: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.SUPABASE_SECRET_KEY!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`impersonation-mfa:${userId}:${sessionId}`));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}
