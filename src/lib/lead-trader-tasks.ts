import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadTraderTask = { key: string; done: boolean };

// The mandatory checklist a self-service lead trader must clear before
// appearing in Discover (Phase 7). Computed live from real data every time
// (same philosophy as the tier calculation) rather than stored, so there is
// nothing to keep in sync.
export async function computeLeadTraderTasks(supabase: SupabaseClient, providerId: string, userId: string): Promise<{ tasks: LeadTraderTask[]; eligible: boolean }> {
  const [{ data: provider }, { data: application }, { count: closedTrades }] = await Promise.all([
    supabase.from("providers").select("bio, symbol_bias").eq("id", providerId).single(),
    supabase.from("lead_trader_applications").select("trading_style").eq("user_id", userId).eq("status", "approved").order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("signals").select("id", { count: "exact", head: true }).eq("provider_id", providerId).eq("created_by_admin", false).eq("status", "closed"),
  ]);

  const tasks: LeadTraderTask[] = [
    { key: "profile", done: !!provider?.bio && (provider?.symbol_bias?.length ?? 0) > 0 },
    { key: "tradingStyle", done: !!application?.trading_style },
    { key: "firstTenTrades", done: (closedTrades ?? 0) >= 10 },
  ];

  return { tasks, eligible: tasks.every((t) => t.done) };
}

// Only self-service lead traders (a real providers.user_id) are subject to
// the checklist at all -- platform-generated leaders (user_id null, the
// entire pre-existing roster) are completely unaffected, so Discover's
// existing behavior for them never changes.
export async function isSelfServiceLeadTraderEligible(supabase: SupabaseClient, providerId: string): Promise<boolean> {
  const { data: provider } = await supabase.from("providers").select("user_id").eq("id", providerId).single();
  if (!provider?.user_id) return true;
  const { eligible } = await computeLeadTraderTasks(supabase, providerId, provider.user_id);
  return eligible;
}
