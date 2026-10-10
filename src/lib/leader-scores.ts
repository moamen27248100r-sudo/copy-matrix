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
//   safety      = clamp(100 - 1.5 x annualised volatility%)     volatility = stddev of the daily
//                 returns over 180 days (vol_daily_pct) x sqrt(365); higher is better
//   risk        = clamp(1.6 x mdd_all%)                         largest drop of the equity curve from
//                 its peak; higher is WORSE (shown red from 50, i.e. a drawdown over ~31%)
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
  safety: number | null;
  risk: number | null;
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
  const vol = num(row.return_volatility);
  const mdd = num(row.mdd_all);
  const rating = num(row.rating_score);
  const limit = num(row.limit_pct);
  const perWeek = num(row.trades_per_week) ?? 0;
  return {
    reliability: hasTrades && rating != null ? clamp(rating) : null,
    safety: hasTrades && vol != null ? clamp(100 - vol * Math.sqrt(365) * 1.5) : null,
    risk: hasTrades && mdd != null ? clamp(mdd * 1.6) : null,
    limit: hasTrades && limit != null ? clamp(limit) : null,
    activity: activityLevel(perWeek),
    tradesPerWeek: perWeek,
    activeDays: num(row.active_days) ?? 0,
  };
}
