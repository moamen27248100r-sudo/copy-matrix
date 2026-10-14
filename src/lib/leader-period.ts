// Leader stats are stored per period on provider_stats (exposed through
// provider_cards as roi_7d, roi_30d, ..., roi_all): these helpers pick the
// column set for one period so the discover page, the cards and the compare
// view all read the same numbers.

export const PERIODS = ["7", "30", "90", "180", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = "30";

export function parsePeriod(value: string | undefined): Period {
  return (PERIODS as readonly string[]).includes(value ?? "") ? (value as Period) : DEFAULT_PERIOD;
}

const suffix = (p: Period) => (p === "all" ? "all" : `${p}d`);

export function periodColumns(p: Period) {
  const s = suffix(p);
  return {
    roi: `roi_${s}`,
    pnl: `pnl_${s}`,
    winRate: `win_rate_${s}`,
    mdd: `mdd_${s}`,
    sharpe: `sharpe_${s}`,
    trades: `trades_${s}`,
  } as const;
}

import { hasEnoughSample } from "@/lib/leader-scores";

export type PeriodStats = {
  /** false when fewer than MIN_CLOSED_TRADES trades closed in the period: return, win rate, drawdown and Sharpe are then null */
  sufficient: boolean;
  roi: number | null;
  pnl: number | null;
  winRate: number | null;
  mdd: number | null;
  sharpe: number | null;
  trades: number | null;
};

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

export function periodStats(row: Record<string, unknown>, p: Period): PeriodStats {
  const c = periodColumns(p);
  const trades = num(row[c.trades]);
  // Below the minimum sample the percentages swing on a handful of trades: show nothing.
  const sufficient = hasEnoughSample(trades);
  return {
    sufficient,
    roi: sufficient ? num(row[c.roi]) : null,
    pnl: num(row[c.pnl]),
    winRate: sufficient ? num(row[c.winRate]) : null,
    mdd: sufficient ? num(row[c.mdd]) : null,
    sharpe: sufficient ? num(row[c.sharpe]) : null,
    trades,
  };
}

// provider_stats stores the risk level with its Arabic database value.
export const RISK_DB_VALUE = { low: "منخفضة", medium: "متوسطة", high: "مرتفعة" } as const;
export type RiskKey = keyof typeof RISK_DB_VALUE;

export const STYLES = ["scalper", "day", "swing", "position"] as const;
export type Style = (typeof STYLES)[number];
