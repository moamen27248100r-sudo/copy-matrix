import type { SupabaseClient } from "@supabase/supabase-js";
import type { Period } from "@/lib/leader-period";

// Maximum drawdown of each leader for a period INCLUDING the floating losses of their open trades
// (database function leader_adjusted_drawdown, migration 0257; formula in lib/leader-scores.ts).
// The caller combines it with the stored figure through adjustedMaxDrawdown() so a number is never
// lower than the closed-trade one. Missing entries mean "no adjustment available".
export async function adjustedDrawdowns(supabase: SupabaseClient, ids: string[], period: Period): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const days = period === "all" ? 0 : Number(period);
  const { data } = await supabase.rpc("leader_adjusted_drawdown", { p_provider_ids: ids.slice(0, 60), p_days: days });
  for (const r of (data ?? []) as { provider_id: string; mdd: number | string | null }[]) {
    if (r.mdd != null) out.set(r.provider_id, Number(r.mdd));
  }
  return out;
}
