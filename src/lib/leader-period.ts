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

export type PeriodStats = {
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
  return {
    roi: num(row[c.roi]),
    pnl: num(row[c.pnl]),
    winRate: num(row[c.winRate]),
    mdd: num(row[c.mdd]),
    sharpe: num(row[c.sharpe]),
    trades: num(row[c.trades]),
  };
}

// provider_stats stores the risk level with its Arabic database value.
export const RISK_DB_VALUE = { low: "منخفضة", medium: "متوسطة", high: "مرتفعة" } as const;
export type RiskKey = keyof typeof RISK_DB_VALUE;

export const STYLES = ["scalper", "day", "swing", "position"] as const;
export type Style = (typeof STYLES)[number];
