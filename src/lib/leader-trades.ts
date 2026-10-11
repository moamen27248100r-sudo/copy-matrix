import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveLevels, tradeProfitUsd, tradeReturnPct } from "@/lib/pip-specs";
import { afterCursorFilter, splitBatch, TRADES_BATCH, type TradeCursor, type TradeFilter } from "@/lib/trade-paging";

// One closed trade of a leader as the history list shows it.
export type HistoryTrade = {
  id: string;
  symbol: string;
  side: string;
  lot: number | null;
  entry: number;
  exit: number;
  /** Realized result in USD; null when the lot size isn't known. */
  pnl: number | null;
  /** Direction-adjusted % return (negative for a loss). */
  pct: number;
  openedAt: string | null;
  closedAt: string | null;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: number | null;
  commission: number | null;
  copyHref: string;
};

/** Every closed trade of the leader per UTC day and symbol (provider_trade_days):
 *  [day, symbol, trades, pnl, swap, commission], money in cents. */
export type TradeDay = [string, string, number, number, number, number];

export type SignalRow = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  close_trigger: string | null;
  lot_size: number | null;
  commission: number | null;
  swap: number | null;
  pnl_usd: number | null;
};

// Public signal columns only (the others are not readable by clients).
export const SIGNAL_COLUMNS =
  "id, symbol, side, entry_price, exit_price, stop_loss, take_profit, status, opened_at, closed_at, close_trigger, lot_size, commission, swap, pnl_usd";

export function toHistoryTrade(s: SignalRow): HistoryTrade {
  const entry = Number(s.entry_price);
  const exit = Number(s.exit_price);
  const lot = s.lot_size != null ? Number(s.lot_size) : null;
  const { stopLoss, takeProfit } = resolveLevels(
    s.side,
    entry,
    s.stop_loss != null ? Number(s.stop_loss) : null,
    s.take_profit != null ? Number(s.take_profit) : null,
  );
  return {
    id: s.id,
    symbol: s.symbol,
    side: s.side,
    lot,
    entry,
    exit,
    pnl: s.pnl_usd != null ? Number(s.pnl_usd) : tradeProfitUsd(s.symbol, s.side, entry, exit, lot),
    pct: tradeReturnPct(s.side, entry, exit),
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    stopLoss,
    takeProfit,
    swap: s.swap != null ? Number(s.swap) : null,
    commission: s.commission != null ? Number(s.commission) : null,
    copyHref: "#copy",
  };
}

/**
 * One batch of a leader's closed trades, newest first, after `cursor`. Row-level security keeps hidden and
 * admin-created trades out; the keyset (closed_at, id) makes each batch exact however many trades there are.
 */
export async function fetchLeaderTrades(
  supabase: SupabaseClient,
  providerId: string,
  filter: TradeFilter,
  cursor: TradeCursor | null,
  limit: number = TRADES_BATCH,
): Promise<{ trades: HistoryTrade[]; hasMore: boolean }> {
  let q = supabase
    .from("signals")
    .select(SIGNAL_COLUMNS)
    .eq("provider_id", providerId)
    .eq("hidden", false)
    .eq("status", "closed")
    .not("exit_price", "is", null)
    .not("closed_at", "is", null);
  if (filter.from) q = q.gte("closed_at", filter.from);
  if (filter.to) q = q.lt("closed_at", filter.to);
  if (filter.symbol) q = q.eq("symbol", filter.symbol);
  if (cursor) q = q.or(afterCursorFilter(cursor));
  const { data, error } = await q.order("closed_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (error) throw new Error(error.message);
  const { batch, hasMore } = splitBatch((data ?? []) as unknown as SignalRow[], limit);
  return { trades: batch.map(toHistoryTrade), hasMore };
}
