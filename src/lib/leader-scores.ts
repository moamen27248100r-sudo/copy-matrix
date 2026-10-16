// The reliability gauges shown for a leader, all derived from provider_stats
// (exposed through provider_cards), which public.refresh_provider_stats
// computes from the leader's trades and its daily ledger. A leader with no
// closed trade has no score (null), never a made-up default.
//
//   reliability = rating_score (0-100, refresh_provider_stats):
//       100 x ( 0.32 x clamp01((roi_180d% + 20) / 60)          return over 180 days
//             + 0.25 x clamp01(1 - mdd_all% / 50)               drawdown
//             + 0.18 x positive_months / months_counted         consistency (last 12 full months, 0.5 if none)
//             + 0.15 x min(1, track_days / 540)                 length of the record
//             + 0.10 x clamp01((win_rate_all% - 35) / 35) )     win rate
//   (risk: one measure only, provider_stats.risk_level from realized volatility, migration 0265;
//    see riskLevelKey below)
//   limit       = limit_pct: share of closed trades that ended at their stop loss or take
//                 profit (the rest closed by hand or on time); higher is better
//   activity    = trades_per_week (closed trades of the last 90 days per week):
//                 high >= 5, medium >= 1, low > 0, none = 0
//   activeDays  = UTC days with a trade opened or closed

export type LeaderStatsRow = {
  rating_score?: number | string | null;
  return_volatility?: number | string | null;
  mdd_all?: number | string | null;
  limit_pct?: number | string | null;
  trades_per_week?: number | string | null;
  active_days?: number | string | null;
  closed_signals?: number | string | null;
};

export type ActivityLevel = "high" | "medium" | "low" | "none";

export type LeaderScores = {
  reliability: number | null;
  limit: number | null;
  activity: ActivityLevel;
  tradesPerWeek: number;
  activeDays: number;
};

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function activityLevel(tradesPerWeek: number): ActivityLevel {
  if (tradesPerWeek >= 5) return "high";
  if (tradesPerWeek >= 1) return "medium";
  if (tradesPerWeek > 0) return "low";
  return "none";
}

export function leaderScores(row: LeaderStatsRow): LeaderScores {
  const hasTrades = (num(row.closed_signals) ?? 0) > 0;
  const rating = num(row.rating_score);
  const limit = num(row.limit_pct);
  const perWeek = num(row.trades_per_week) ?? 0;
  return {
    reliability: hasTrades && rating != null ? clamp(rating) : null,
    limit: hasTrades && limit != null ? clamp(limit) : null,
    activity: activityLevel(perWeek),
    tradesPerWeek: perWeek,
    activeDays: num(row.active_days) ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Sample size and a drawdown that includes floating losses
//
// MIN_CLOSED_TRADES: the win rate, the maximum drawdown and the return of a period are shown only
// when the leader closed at least this many trades in it. Below that the numbers swing on one or
// two trades, so the app shows "—" with a hint ("not enough data for this period") and keeps those
// leaders out of the top places of performance rankings.
//
// Maximum drawdown with floating losses (adjustedMaxDrawdown)
//   The stored figure (provider_stats.mdd_*) is the largest peak-to-trough drop of the DAILY
//   closed-trade equity curve. A trade that went deep into loss and recovered, or one still open,
//   never shows there. This function adds what the open trades went through:
//
//     realized(t)   start equity + results of the trades closed up to t
//     peak(t)       highest realized(t') for t' <= t
//     worstMoment_i the time of trade i's lowest floating result (from price history), or its close
//                   when no price history covers it
//     floor_i       min(0, worst floating result, final result) of trade i
//     equity_i      realized(worstMoment_i) + floor_i
//     drawdown_i    (peak(worstMoment_i) - equity_i) / peak(worstMoment_i)
//
//   The result is the largest drawdown_i, also considering the closed-only drop after every close,
//   as a percentage. Limits, stated plainly: price history exists only for the most recent days,
//   so older trades are bounded by their own final result; and the floating losses of trades open
//   at the same time are not added together (each trade is taken at its own worst moment).
//   adjustedMaxDrawdown never returns less than the stored figure it is given.
// ---------------------------------------------------------------------------------------------

export const MIN_CLOSED_TRADES = 20;

export function hasEnoughSample(closedTrades: number | string | null | undefined): boolean {
  const n = num(closedTrades);
  return n != null && n >= MIN_CLOSED_TRADES;
}

export type ExtremeTrade = {
  /** opened / closed in epoch ms; closed is null while the trade is open */
  o: number;
  c: number | null;
  /** final result in USD (null while open) */
  pnl: number | null;
  /** lowest floating result seen while open (USD), null when no price history covers the trade */
  worst: number | null;
  /** when that happened, epoch ms */
  wt: number | null;
};

export function maxDrawdownWithFloating(trades: ExtremeTrade[], startEquity: number, nowMs: number): number | null {
  if (!(startEquity > 0)) return null;

  const closed = trades
    .filter((t) => t.c != null && t.pnl != null)
    .map((t) => ({ c: t.c as number, pnl: t.pnl as number }))
    .sort((a, b) => a.c - b.c);

  // realized equity after every close, with the running peak
  const times: number[] = [];
  const equity: number[] = [];
  const peaks: number[] = [];
  let cum = startEquity;
  let peak = startEquity;
  let worst = 0;
  for (const t of closed) {
    cum += t.pnl;
    peak = Math.max(peak, cum);
    times.push(t.c);
    equity.push(cum);
    peaks.push(peak);
    worst = Math.max(worst, peak > 0 ? (peak - cum) / peak : 0);
  }

  // last close strictly before a moment (binary search): the trade itself is not yet realized then
  const stateAt = (t: number): { eq: number; pk: number } => {
    let lo = 0;
    let hi = times.length - 1;
    let idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] < t) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return idx < 0 ? { eq: startEquity, pk: startEquity } : { eq: equity[idx], pk: peaks[idx] };
  };

  for (const t of trades) {
    const floor = Math.min(0, t.worst ?? 0, t.pnl ?? 0);
    if (floor >= 0) continue;
    const moment = t.wt ?? t.c ?? nowMs;
    const { eq, pk } = stateAt(moment);
    const dd = pk > 0 ? (pk - (eq + floor)) / pk : 0;
    worst = Math.max(worst, dd);
  }
  return Math.round(worst * 10000) / 100;
}

// Never below the stored (closed-trade, daily) figure.
export function adjustedMaxDrawdown(stored: number | null | undefined, computed: number | null): number | null {
  const s = num(stored);
  if (computed == null) return s;
  return s == null ? computed : Math.max(s, computed);
}

/** provider_stats.risk_level (0265, realized volatility; stored as the Arabic word) as a key. */
export function riskLevelKey(level: string | null | undefined): "low" | "medium" | "high" | null {
  return level === "منخفضة" ? "low" : level === "متوسطة" ? "medium" : level === "مرتفعة" ? "high" : null;
}
