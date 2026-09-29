import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadHistoryRow = {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number | null;
  pct: number;
  openedAt: string;
  closedAt: string | null;
  copiers: number;
};

export type LeadHistoryFilters = { symbol?: string; result?: string; days?: number };

// The lead trader's own closed orders (their `signals` rows), with how many
// followers each one was mirrored to (a count of `simulated_positions`).
export async function fetchLeadTraderHistory(
  supabase: SupabaseClient,
  providerId: string,
  filters: LeadHistoryFilters = {},
): Promise<{ rows: LeadHistoryRow[]; symbols: string[] }> {
  let query = supabase
    .from("signals")
    .select("id, symbol, side, entry_price, exit_price, opened_at, closed_at")
    .eq("provider_id", providerId)
    .eq("status", "closed")
    .not("exit_price", "is", null)
    .order("closed_at", { ascending: false });

  if (filters.days) query = query.gte("closed_at", new Date(Date.now() - filters.days * 86400000).toISOString());

  const { data } = await query;
  type Row = { id: string; symbol: string; side: string; entry_price: number; exit_price: number; opened_at: string; closed_at: string };
  const all = (data ?? []) as Row[];

  const ids = all.map((r) => r.id);
  const { data: positions } = ids.length ? await supabase.from("simulated_positions").select("signal_id").in("signal_id", ids) : { data: [] as { signal_id: string }[] };
  const copierCount = new Map<string, number>();
  for (const p of positions ?? []) copierCount.set(p.signal_id, (copierCount.get(p.signal_id) ?? 0) + 1);

  const rows: LeadHistoryRow[] = all.map((r) => {
    const raw = (r.exit_price - r.entry_price) / r.entry_price;
    const pct = (r.side === "sell" ? -raw : raw) * 100;
    return {
      id: r.id,
      symbol: r.symbol,
      side: r.side,
      entryPrice: Number(r.entry_price),
      exitPrice: Number(r.exit_price),
      pct,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      copiers: copierCount.get(r.id) ?? 0,
    };
  });

  const filtered = rows.filter(
    (r) => (!filters.symbol || r.symbol === filters.symbol) && (filters.result !== "win" || r.pct >= 0) && (filters.result !== "loss" || r.pct < 0),
  );

  return { rows: filtered, symbols: Array.from(new Set(rows.map((r) => r.symbol))).sort() };
}
