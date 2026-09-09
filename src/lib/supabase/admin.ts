import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only ever use this from
// trusted server-side admin actions (never expose SUPABASE_SECRET_KEY to
// the client), and only for operations the regular per-request client
// genuinely can't do, like generating a sign-in link for another user.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
