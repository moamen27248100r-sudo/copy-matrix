// Pure helpers behind the leader's trade history, which is loaded from the server in batches.
// (No imports: unit-tested directly by tests/trade-paging.test.mjs.)

export const TRADES_BATCH = 50;

export const PERIOD_KEYS = ["today", "week", "month", "threeMonths", "sixMonths", "year", "all", "custom"] as const;
export type HistoryPeriodKey = (typeof PERIOD_KEYS)[number];
export type CustomDayRange = { from: string; to: string }; // YYYY-MM-DD, inclusive both ends

export type TradeCursor = { closedAt: string; id: string };

/** The filter a batch is read with: closed_at in [from, to) (ISO instants, UTC) and an optional symbol. */
export type TradeFilter = { from: string | null; to: string | null; symbol: string | null };

const DAY = 24 * 60 * 60 * 1000;
// N days = today and the N - 1 UTC days before it, like the leader's stats.
const WINDOW_DAYS: Partial<Record<HistoryPeriodKey, number>> = { today: 1, week: 7, month: 30, threeMonths: 90, sixMonths: 180, year: 365 };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const startOfDay = (day: string) => `${day}T00:00:00.000Z`;

/** Period + symbol -> the batch filter. "all" has no bounds; a custom range needs valid ordered days. */
export function tradeFilterFor(period: HistoryPeriodKey, custom: CustomDayRange | null, symbol: string | null, nowMs: number): TradeFilter {
  let from: string | null = null;
  let to: string | null = null;
  if (period === "custom") {
    if (custom && DAY_RE.test(custom.from) && DAY_RE.test(custom.to) && custom.from <= custom.to) {
      from = startOfDay(custom.from);
      to = new Date(Date.parse(startOfDay(custom.to)) + DAY).toISOString(); // exclusive: the whole last day
    }
  } else if (period !== "all") {
    const days = WINDOW_DAYS[period] ?? 1;
    const now = new Date(nowMs);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    from = new Date(today - (days - 1) * DAY).toISOString();
  }
  return { from, to, symbol: symbol && symbol.length > 0 ? symbol : null };
}

/** A filter that selects everything the server already sent in the first batch. */
export function isUnfiltered(f: TradeFilter): boolean {
  return f.from == null && f.to == null && f.symbol == null;
}

/** Keyset cursor for "the batch after this trade" (closed_at desc, id desc). */
export function cursorOf(t: { closedAt: string | null; id: string }): TradeCursor | null {
  return t.closedAt ? { closedAt: t.closedAt, id: t.id } : null;
}

/** PostgREST `or` expression for rows strictly after the cursor in (closed_at desc, id desc) order. */
export function afterCursorFilter(c: TradeCursor): string {
  return `closed_at.lt.${c.closedAt},and(closed_at.eq.${c.closedAt},id.lt.${c.id})`;
}

/** Appends a batch, dropping any trade already shown (a re-sent boundary row, a double fetch). */
export function mergeBatch<T extends { id: string }>(existing: readonly T[], batch: readonly T[]): T[] {
  const seen = new Set(existing.map((t) => t.id));
  const fresh = batch.filter((t) => !seen.has(t.id));
  return fresh.length === 0 ? [...existing] : [...existing, ...fresh];
}

/** Splits `limit + 1` fetched rows into the batch and whether more exist behind it. */
export function splitBatch<T>(rows: readonly T[], limit: number): { batch: T[]; hasMore: boolean } {
  return rows.length > limit ? { batch: rows.slice(0, limit), hasMore: true } : { batch: [...rows], hasMore: false };
}
