import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  // Sessions are created by this server, so without forwarding the browser's
  // user agent and address the "devices & sessions" list would show every
  // sign-in as the server itself ("node").
  const userAgent = requestHeaders.get("user-agent");
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: {
          ...(userAgent ? { "User-Agent": userAgent } : {}),
          ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
        },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when
            // middleware is also refreshing the session.
          }
        },
      },
    },
  );
}
