// Portfolio risk indicator (low / medium / high) shown on the customer dashboard.
// The one place the formula lives; the dashboard only feeds it numbers.
//
//   score (0..100) =  40 * reserved share            money reserved in copies / total balance, 0..1
//                  +  30 * drawdown share            current drop from the portfolio's peak, capped at 20%
//                  +  30 * trader risk share         average risk level of the copied traders,
//                                                    weighted by the amount allocated to each
//                                                    (low = 0, medium = 0.5, high = 1)
//
//   score < 35  -> low        35 <= score < 65 -> medium        score >= 65 -> high
//
// With no active copies the first and last parts are zero, so only a falling portfolio can raise it.
// The weights are a simple, explainable rule of thumb for display; they are not a prediction.

export type RiskLevel = "low" | "medium" | "high";

export type RiskInput = {
  /** Money reserved in active copies divided by the balance (0..1; larger values are capped). */
  reservedRatio: number;
  /** Current drop of the portfolio from its peak, in % (>= 0). */
  drawdownPct: number;
  /** Copied traders: risk level 1 (low) .. 3 (high) and the amount allocated to each. */
  leaders: { level: 1 | 2 | 3; amount: number }[];
};

export type RiskResult = {
  score: number;
  level: RiskLevel;
  parts: { reserved: number; drawdown: number; leaders: number };
};

export const RISK_WEIGHTS = { reserved: 40, drawdown: 30, leaders: 30 } as const;
export const DRAWDOWN_CAP_PCT = 20;
export const LOW_BELOW = 35;
export const HIGH_FROM = 65;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function computeRisk(input: RiskInput): RiskResult {
  const reserved = RISK_WEIGHTS.reserved * clamp01(input.reservedRatio);
  const drawdown = RISK_WEIGHTS.drawdown * clamp01(input.drawdownPct / DRAWDOWN_CAP_PCT);

  const totalAmount = input.leaders.reduce((s, l) => s + Math.max(0, l.amount), 0);
  let leaders = 0;
  if (totalAmount > 0) {
    const avgLevel = input.leaders.reduce((s, l) => s + l.level * Math.max(0, l.amount), 0) / totalAmount;
    leaders = RISK_WEIGHTS.leaders * clamp01((avgLevel - 1) / 2);
  } else if (input.leaders.length > 0) {
    const avgLevel = input.leaders.reduce((s, l) => s + l.level, 0) / input.leaders.length;
    leaders = RISK_WEIGHTS.leaders * clamp01((avgLevel - 1) / 2);
  }

  const score = Math.round((reserved + drawdown + leaders) * 10) / 10;
  const level: RiskLevel = score < LOW_BELOW ? "low" : score < HIGH_FROM ? "medium" : "high";
  return { score, level, parts: { reserved, drawdown, leaders } };
}

// The platform stores a trader's risk level as its Arabic label.
export function leaderRiskLevel(label: string | null | undefined): 1 | 2 | 3 | null {
  if (label === "منخفضة") return 1;
  if (label === "متوسطة") return 2;
  if (label === "مرتفعة") return 3;
  return null;
}

// Current drop from the peak of the account's value, from the cumulative result series
// (closed trades, oldest first) and the floating result of open trades.
//   value(k) = start + cumulative result up to k, where start = net invested - total realized result
export function currentDrawdownPct(series: { v: number }[], netInvested: number, realizedTotal: number, unrealized: number): number {
  const start = netInvested - realizedTotal;
  let cum = 0;
  let peak = start;
  for (const p of series) {
    cum += p.v;
    if (start + cum > peak) peak = start + cum;
  }
  const now = start + cum + unrealized;
  if (!(peak > 0)) return 0;
  return Math.max(0, ((peak - now) / peak) * 100);
}
