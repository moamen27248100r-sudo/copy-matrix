// Pure helpers behind the interactive chart (components/charts/AreaLineChart).

/** Index of the entry of `xs` (ascending) nearest to `x`; the earlier one on a tie. */
export function nearestIndex(xs: readonly number[], x: number): number {
  const n = xs.length;
  if (n === 0) return -1;
  if (x <= xs[0]) return 0;
  if (x >= xs[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return x - xs[lo] <= xs[hi] - x ? lo : hi;
}

/**
 * Change of the value at `index` against the start of the period (the first
 * value): the absolute move, and its size relative to the starting value
 * (null when the series starts at zero, where a ratio is undefined).
 */
export function periodChange(values: readonly number[], index: number): { abs: number; pct: number | null } {
  if (values.length === 0) return { abs: 0, pct: null };
  const i = Math.min(Math.max(index, 0), values.length - 1);
  const start = values[0];
  const abs = values[i] - start;
  return { abs, pct: start !== 0 ? (abs / Math.abs(start)) * 100 : null };
}
