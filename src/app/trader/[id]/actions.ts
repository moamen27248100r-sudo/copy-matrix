"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchLeaderTrades, type HistoryTrade } from "@/lib/leader-trades";
import { PERIOD_KEYS, tradeFilterFor, type CustomDayRange, type HistoryPeriodKey, type TradeCursor } from "@/lib/trade-paging";
import { isUuid } from "@/lib/uuid";

const SYMBOL_RE = /^[A-Z0-9]{3,16}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/;

export type LoadTradesInput = {
  providerId: string;
  period: HistoryPeriodKey;
  custom: CustomDayRange | null;
  symbol: string | null;
  cursor: TradeCursor | null;
};

export type LoadTradesResult = { trades: HistoryTrade[]; hasMore: boolean } | { error: true };

// The next batch (50) of a leader's trade history for the chosen period / symbol. Everything arriving from
// the browser is validated here; reads go through the viewer's own session, so row-level security applies.
export async function loadLeaderTrades(input: LoadTradesInput): Promise<LoadTradesResult> {
  if (!isUuid(input.providerId)) return { error: true };
  if (!(PERIOD_KEYS as readonly string[]).includes(input.period)) return { error: true };
  if (input.symbol != null && !SYMBOL_RE.test(input.symbol)) return { error: true };
  if (input.custom && !(DAY_RE.test(input.custom.from) && DAY_RE.test(input.custom.to))) return { error: true };
  if (input.cursor && !(ISO_RE.test(input.cursor.closedAt) && isUuid(input.cursor.id))) return { error: true };

  const filter = tradeFilterFor(input.period, input.custom, input.symbol, Date.now());
  try {
    const supabase = await createClient();
    return await fetchLeaderTrades(supabase, input.providerId, filter, input.cursor);
  } catch {
    return { error: true };
  }
}
