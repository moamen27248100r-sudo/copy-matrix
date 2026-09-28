import type { SupabaseClient } from "@supabase/supabase-js";

type PositionSignal = { symbol: string; side: string; provider_id: string; stop_loss: number | null; take_profit: number | null };

export type ClosedTrade = {
  id: string;
  symbol: string;
  side: string;
  size: number;
  entry: number;
  exit: number | null;
  pnl: number;
  pct: number;
  openedAt: string;
  closedAt: string | null;
  copyHref?: string;
  providerId: string | null;
  providerName: string;
  stopLoss: number | null;
  takeProfit: number | null;
};

export type TradeFilters = { symbol?: string; provider?: string; result?: string; days?: number };

// The customer's closed copied positions, newest first, with the optional
// history filters applied (symbol / trader / win-loss / last N days).
export async function fetchClosedTrades(
  supabase: SupabaseClient,
  userId: string,
  filters: TradeFilters = {},
): Promise<{ trades: ClosedTrade[]; symbols: string[]; providers: { id: string; name: string }[] }> {
  const { data } = await supabase
    .from("simulated_positions")
    .select("id, entry_price, exit_price, size, pnl, opened_at, closed_at, signals(symbol, side, provider_id, stop_loss, take_profit)")
    .eq("follower_id", userId)
    .eq("status", "closed")
    .order("closed_at", { ascending: false });

  type Row = {
    id: string;
    entry_price: number;
    exit_price: number | null;
    size: number;
    pnl: number | null;
    opened_at: string;
    closed_at: string | null;
    signals: PositionSignal | PositionSignal[] | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const providerIds = Array.from(
    new Set(rows.map((r) => (Array.isArray(r.signals) ? r.signals[0] : r.signals)?.provider_id).filter((x): x is string => !!x)),
  );
  const { data: cards } = providerIds.length
    ? await supabase.from("provider_cards").select("provider_id, display_name").in("provider_id", providerIds)
    : { data: [] as { provider_id: string; display_name: string }[] };
  const nameById = new Map((cards ?? []).map((c) => [c.provider_id, c.display_name]));

  const all: ClosedTrade[] = rows.map((r) => {
    const s = Array.isArray(r.signals) ? r.signals[0] ?? null : r.signals;
    const raw = r.exit_price != null ? (r.exit_price - r.entry_price) / r.entry_price : 0;
    return {
      id: r.id,
      symbol: s?.symbol ?? "—",
      side: s?.side ?? "buy",
      size: Number(r.size),
      entry: Number(r.entry_price),
      exit: r.exit_price != null ? Number(r.exit_price) : null,
      pnl: r.pnl ?? 0,
      pct: (s?.side === "sell" ? -raw : raw) * 100,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      copyHref: s?.provider_id ? `/trader/${s.provider_id}#copy` : undefined,
      providerId: s?.provider_id ?? null,
      providerName: s ? nameById.get(s.provider_id) ?? "—" : "—",
      stopLoss: s?.stop_loss ?? null,
      takeProfit: s?.take_profit ?? null,
    };
  });

  const cutoff = filters.days ? Date.now() - filters.days * 86400000 : null;
  const trades = all.filter(
    (t) =>
      (!filters.symbol || t.symbol === filters.symbol) &&
      (!filters.provider || t.providerId === filters.provider) &&
      (filters.result !== "win" || t.pnl >= 0) &&
      (filters.result !== "loss" || t.pnl < 0) &&
      (!cutoff || (t.closedAt != null && new Date(t.closedAt).getTime() >= cutoff)),
  );
  return {
    trades,
    symbols: Array.from(new Set(all.map((t) => t.symbol))).sort(),
    providers: providerIds.map((id) => ({ id, name: nameById.get(id) ?? id })),
  };
}
