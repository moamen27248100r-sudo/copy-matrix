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

// +1 for buy, -1 for sell. Every result below is signed by this, so a
// losing trade is negative in $, %, and Δ points alike.
export function tradeDirection(side: string): 1 | -1 {
  return side === "sell" ? -1 : 1;
}

// Price move in the trade's favour (exit - entry for a buy, entry - exit
// for a sell).
export function tradeDeltaPoints(side: string, entry: number, exit: number): number {
  return (exit - entry) * tradeDirection(side);
}

export function tradeReturnPct(side: string, entry: number, exit: number): number {
  return (tradeDeltaPoints(side, entry, exit) / entry) * 100;
}

// Close reason derived from the prices — same rule as the database's
// trade_close_trigger() (0215): at the target in profit = "tp", at the
// stop in loss = "sl", flat = "breakeven", otherwise the requested
// timeout/margin-call/manual reason.
export function deriveCloseTrigger(
  side: string,
  entry: number,
  exit: number,
  stopLoss: number | null,
  takeProfit: number | null,
  requested: string | null = null,
): string {
  const d = tradeDeltaPoints(side, entry, exit);
  const tol = (level: number) => Math.max(Math.abs(level - entry) * 0.05, entry * 0.0001);
  if (takeProfit != null && d > 0 && Math.abs(exit - takeProfit) <= tol(takeProfit)) return "tp";
  if (stopLoss != null && d < 0 && Math.abs(exit - stopLoss) <= tol(stopLoss)) return "sl";
  if (requested === "margin_call" && d < 0) return "margin_call";
  if (Math.abs(d) <= entry * 0.0002) return "breakeven";
  return requested === "timeout" ? "timeout" : "manual";
}

// True when each given level is positive and on its correct side of
// entry (buy: stop below, target above; sell: the reverse).
export function levelsValid(side: string, entry: number, stopLoss: number | null, takeProfit: number | null): boolean {
  const dir = tradeDirection(side);
  if (stopLoss != null && !(stopLoss > 0 && (stopLoss - entry) * dir < 0)) return false;
  if (takeProfit != null && !(takeProfit > 0 && (takeProfit - entry) * dir > 0)) return false;
  return true;
}

// Floating P/L of an open position, the same rule the database settles it by
// (`((exit-entry)/entry) * size * sign`, where size is the position's dollar
// notional). There is no leverage in this model: the lot size is already baked
// into `size` (see computeLotSize).
export function openPositionPnl(side: string, entry: number, current: number, size: number) {
  const pct = (((current - entry) / entry) * tradeDirection(side)) * 100;
  return { pct, usd: (pct / 100) * size };
}

// Inverse of computeLotSize's sizeDollars: the lot size an open position's
// dollar notional corresponds to. null when the symbol or entry is unknown.
export function lotsFromSize(symbol: string, entry: number, size: number): number | null {
  const spec = PIP_SPECS[symbol];
  if (!spec || !(entry > 0) || !(size > 0)) return null;
  return Math.round(((size * spec.pipSize) / (spec.pipValuePerLot * entry)) * 100) / 100;
}

export const FOREX_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY"];
