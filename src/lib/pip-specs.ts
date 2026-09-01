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
