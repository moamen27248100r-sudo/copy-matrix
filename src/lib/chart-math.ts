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
