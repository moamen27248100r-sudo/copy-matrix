// How a leader's headline statistics are written, everywhere (cards, the
// discover table, the profile, the card sparkline). One definition, so the same
// number never shows two different roundings:
//   return        +7.44%   two decimals, "+" when positive
//   drawdown      -3.02%   two decimals, always a loss (a minus sign), 0.00% when none
//   win rate      71.0%    one decimal
// A missing value is an em dash.

const DASH = "—";

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

export function fmtReturn(v: number | null | undefined): string {
  if (!finite(v)) return DASH;
  const rounded = Number(v.toFixed(2));
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)}%`;
}

export function fmtDrawdown(v: number | null | undefined): string {
  if (!finite(v)) return DASH;
  const mag = Math.abs(v);
  return Number(mag.toFixed(2)) === 0 ? "0.00%" : `-${mag.toFixed(2)}%`;
}

export function fmtWinRate(v: number | null | undefined): string {
  if (!finite(v)) return DASH;
  return `${v.toFixed(1)}%`;
}

/** Wraps a number or amount that is placed inside a translated sentence, so a reversed-direction
 *  sentence ("أكثر من $100,000") keeps the figure intact and in order. */
export const ltrIsolate = (s: string): string => `\u2066${s}\u2069`;
