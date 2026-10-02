import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPendingMfa, MFA_CHALLENGE_PATH } from "@/lib/mfa";
import { IMPERSONATION_MFA_COOKIE, impersonationMfaSignature } from "@/lib/impersonation-mfa";

// Paths a signed-in user who still owes their 2FA code may reach: the
// challenge page itself (its form + sign-out post back to it), the Supabase
// auth callbacks, and endpoints/assets that carry no account data.
const MFA_EXEMPT_PREFIXES = [MFA_CHALLENGE_PATH, "/auth", "/api/prices", "/api/avatar"];
const MFA_EXEMPT_EXACT = ["/manifest.webmanifest", "/icon", "/apple-icon", "/opengraph-image", "/robots.txt", "/sitemap.xml"];

function isMfaExempt(pathname: string) {
  return (
    MFA_EXEMPT_EXACT.includes(pathname) ||
    MFA_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

function mfaRedirectUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = MFA_CHALLENGE_PATH;
  url.search = "";
  if (next !== "/") url.searchParams.set("next", next);
  return url;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token if needed — must run before any route logic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Online status" needs last_seen_at to move while someone is actively
  // browsing, not just at login -- but this middleware runs on nearly every
  // request platform-wide, so writing on every single one would repeat
  // today's mistake (a small-looking per-request write that adds up under
  // real traffic). A short-lived cookie gates it to at most one DB write
  // per active user per ~2 minutes; every request in between is a free
  // cookie check, no query at all.
  const LAST_SEEN_COOKIE = "cm_lsu";
  if (user && !request.cookies.get(LAST_SEEN_COOKIE)) {
    await supabase.rpc("touch_last_seen");
    supabaseResponse.cookies.set(LAST_SEEN_COOKIE, "1", { maxAge: 120, path: "/" });
  }

  // Two-factor gate, enforced here on the server rather than in any page:
  // once a user has a verified TOTP factor, a password/Google/magic-link
  // session (aal1) can't reach anything but the code prompt until Supabase
  // has stepped it up to aal2.
  if (user && !isMfaExempt(request.nextUrl.pathname)) {
    const { pending, sessionId } = await getPendingMfa(supabase, user);
    const impersonationMac = request.cookies.get(IMPERSONATION_MFA_COOKIE)?.value;
    const impersonating =
      pending && !!impersonationMac && !!sessionId && impersonationMac === (await impersonationMfaSignature(user.id, sessionId));

    if (pending && !impersonating) {
      const blocked = request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ error: "mfa_required" }, { status: 401 })
        : NextResponse.redirect(mfaRedirectUrl(request));
      // Carry over any auth cookies getUser() just refreshed.
      supabaseResponse.cookies.getAll().forEach((cookie) => blocked.cookies.set(cookie));
      return blocked;
    }
  }

  return supabaseResponse;
}
