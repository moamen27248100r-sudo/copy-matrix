import type { SupabaseClient } from "@supabase/supabase-js";

// Deposits are switched on and off in one place: platform_settings.deposits_enabled, read
// through public.deposits_enabled() (migration 0252). Anything unknown counts as off.
export async function depositsEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("deposits_enabled");
  return data === true;
}
