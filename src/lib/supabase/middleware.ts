import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  return supabaseResponse;
}
