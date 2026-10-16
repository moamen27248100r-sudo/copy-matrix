import type { SupabaseClient } from "@supabase/supabase-js";

// A button pressed twice (a double tap, two tabs) must do its work once. Each form carries a random
// key (components/IdempotencyField); the first request claims it in the database, any other request
// with the same key is a duplicate and is answered without doing anything.
export async function claimIdempotency(supabase: SupabaseClient, formData: FormData): Promise<boolean> {
  const key = String(formData.get("idempotencyKey") ?? "");
  if (!key) return true;
  const { data, error } = await supabase.rpc("claim_idempotency_key", { p_key: key });
  if (error) return true; // never block a customer because the guard itself is unavailable
  return data === true;
}

export async function releaseIdempotency(supabase: SupabaseClient, formData: FormData) {
  const key = String(formData.get("idempotencyKey") ?? "");
  if (key) await supabase.rpc("release_idempotency_key", { p_key: key });
}
