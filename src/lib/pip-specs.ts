// Simplified, internally-consistent pip/lot conventions for this
// simulated platform — not an exact real-broker spec sheet. Gold gets
// its own real convention (0.1 move = 1 pip) since it's quoted and
// traded differently from forex majors; crypto/index symbols use a
// pip sized to that instrument's own typical price scale, with pip
// value simplified to $1/lot since real per-broker contract sizes for
// these vary too widely to model meaningfully in a demo platform.
export const PIP_SPECS: Record<string, { pipSize: number; pipValuePerLot: number }> = {
  XAUUSD: { pipSize: 0.1, pipValuePerLot: 10 },
  EURUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  GBPUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  USDJPY: { pipSize: 0.01, pipValuePerLot: 9 },
  BTCUSDT: { pipSize: 1, pipValuePerLot: 1 },
  ETHUSDT: { pipSize: 0.1, pipValuePerLot: 1 },
  SOLUSDT: { pipSize: 0.01, pipValuePerLot: 1 },
  BNBUSDT: { pipSize: 0.1, pipValuePerLot: 1 },
  XRPUSDT: { pipSize: 0.0001, pipValuePerLot: 1 },
  US30: { pipSize: 1, pipValuePerLot: 1 },
};

const MIN_LOT = 0.01;

// Reverse-engineers everything needed to make a real trade settle
// through the existing simulated_positions pnl trigger
// (`((exit-entry)/entry) * size * sign`) at exactly the lot-based,
// pip-based loss a real MT5 position of that lot size would produce —
// rather than writing a second, parallel settlement formula.
export function computeLotSize(symbol: string, pips: number, targetLossUsd: number, entryPrice: number) {
  const spec = PIP_SPECS[symbol] ?? PIP_SPECS.XAUUSD;
  const rawLot = targetLossUsd / (pips * spec.pipValuePerLot);
  const lotSize = Math.max(MIN_LOT, Math.round(rawLot * 100) / 100);
  const actualLossUsd = pips * spec.pipValuePerLot * lotSize;
  const sizeDollars = (lotSize * spec.pipValuePerLot * entryPrice) / spec.pipSize;
  return { lotSize, actualLossUsd, sizeDollars, pipSize: spec.pipSize };
}

// Realized dollar result of a closed trade, from the same pip / lot
// conventions the signals were generated with (pips x pip value x lot,
// signed by direction). null when the lot size or symbol spec is unknown.
export function tradeProfitUsd(symbol: string, side: string, entry: number, exit: number, lotSize: number | null | undefined): number | null {
  const spec = PIP_SPECS[symbol];
  if (!spec || lotSize == null || !(lotSize > 0)) return null;
  const dir = side === "sell" ? -1 : 1;
  const pnl = (((exit - entry) * dir) / spec.pipSize) * spec.pipValuePerLot * lotSize;
  return Math.round(pnl * 100) / 100;
}

// S/L and T/P are classified by where they sit relative to the entry, not
// by which column they were stored in: a buy's stop is below entry and its
// target above; a sell is the reverse. This keeps the two from ever being
// shown swapped.
export function resolveLevels(side: string, entry: number, a: number | null, b: number | null) {
  let stopLoss: number | null = null;
  let takeProfit: number | null = null;
  for (const v of [a, b]) {
    if (v == null) continue;
    const below = Number(v) < entry;
    const isStop = side === "sell" ? !below : below;
    if (isStop) stopLoss ??= Number(v);
    else takeProfit ??= Number(v);
  }
  return { stopLoss, takeProfit };
}
