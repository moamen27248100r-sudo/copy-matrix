import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "./uuid.ts";

// Does this leader id exist (as far as the viewer is allowed to see)? Asked in the route layout, which
// renders before loading.tsx starts streaming, so a missing leader is answered with a real 404.
//
// One retry on a database error: the same null a missing row gives also comes back from a dropped
// connection, and that must not turn into a false "not found". A second failure throws (error page).
export async function leaderExists(supabase: SupabaseClient, id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.from("provider_cards").select("provider_id").eq("provider_id", id).maybeSingle();
    if (data) return true;
    if (!error) return false;
    lastError = error;
  }
  throw new Error(`leader lookup failed: ${(lastError as { message?: string })?.message ?? "unknown error"}`);
}
