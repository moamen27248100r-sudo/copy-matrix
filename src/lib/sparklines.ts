import type { SupabaseClient } from "@supabase/supabase-js";

/** The small return curve of each trader card (cumulative % over the last `days` days), for many
 *  traders in one call (migration 0264). Traders the viewer may not see are simply missing. */
export async function getSparklines(supabase: SupabaseClient, ids: string[], days = 30): Promise<Record<string, number[]>> {
  if (ids.length === 0) return {};
  const { data } = await supabase.rpc("provider_sparklines", { p_ids: ids, p_days: days });
  const out: Record<string, number[]> = {};
  for (const row of (data ?? []) as { provider_id: string; series: (number | string)[] }[]) {
    out[row.provider_id] = row.series.map(Number);
  }
  return out;
}
