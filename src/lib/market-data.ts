import { createClient } from "@/lib/supabase/server";
import { INSTRUMENTS, instrumentBySymbol, liveRows, parseSnapshot, type Instrument, type SnapshotRow } from "@/lib/markets";

// Server-side market data for the Markets pages.
//   * the live snapshot (prices, 24h change, sparkline) from the database -- shared for 3 seconds
//     between concurrent requests, so a crowd of open pages costs one query;
//   * 24-hour volume of the crypto pairs from the Binance public API (no key), cached 60 seconds;
//   * chart history and the 52-week range from Binance klines (crypto, gold, euro) or the European
//     Central Bank daily reference rates (GBP/USD, USD/JPY) through Frankfurter -- cached.
// data-api.binance.vision is Binance's public market-data host: it answers from any region.

const BINANCE = "https://data-api.binance.vision/api/v3";
const FRANKFURTER = "https://api.frankfurter.dev/v1";

let snapshotCache: { at: number; rows: SnapshotRow[] } | null = null;

export async function getSnapshot(): Promise<SnapshotRow[]> {
  const now = Date.now();
  if (snapshotCache && now - snapshotCache.at < 3000) return snapshotCache.rows;
  const supabase = await createClient();
  const { data } = await supabase.rpc("market_snapshot");
  const rows = parseSnapshot(data);
  snapshotCache = { at: now, rows };
  return rows;
}

/** The instruments that can be shown right now (known, with a working source), in catalogue order. */
export async function getLiveInstruments() {
  const rows = liveRows(await getSnapshot());
  const order = new Map(INSTRUMENTS.map((i, idx) => [i.symbol, idx]));
  return rows.sort((a, b) => (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0));
}

export type Volume = { quoteVolume: number; high: number | null; low: number | null };

/** 24-hour traded value (USDT) of every crypto instrument, by symbol. Empty when Binance is unreachable. */
export async function getVolumes(): Promise<Record<string, Volume>> {
  const symbols = INSTRUMENTS.filter((i) => i.kind === "crypto").map((i) => i.symbol);
  try {
    const url = `${BINANCE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    const body = (await res.json()) as { symbol: string; quoteVolume: string; highPrice: string; lowPrice: string }[];
    const out: Record<string, Volume> = {};
    for (const r of body) out[r.symbol] = { quoteVolume: Number(r.quoteVolume), high: Number(r.highPrice), low: Number(r.lowPrice) };
    return out;
  } catch {
    return {};
  }
}

export const RANGES = ["1D", "1W", "1M", "3M", "1Y"] as const;
export type Range = (typeof RANGES)[number];
export const isRange = (v: unknown): v is Range => (RANGES as readonly string[]).includes(String(v));

const KLINES: Record<Range, { interval: string; limit: number }> = {
  "1D": { interval: "5m", limit: 288 },
  "1W": { interval: "30m", limit: 336 },
  "1M": { interval: "4h", limit: 180 },
  "3M": { interval: "1d", limit: 90 },
  "1Y": { interval: "1d", limit: 365 },
};
const REVALIDATE: Record<Range, number> = { "1D": 120, "1W": 600, "1M": 1800, "3M": 3600, "1Y": 3600 };

export type HistoryPoint = { t: number; v: number };

async function binanceKlines(pair: string, range: Range): Promise<HistoryPoint[]> {
  const { interval, limit } = KLINES[range];
  const res = await fetch(`${BINANCE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`, { next: { revalidate: REVALIDATE[range] } });
  if (!res.ok) return [];
  const rows = (await res.json()) as unknown[][];
  // [openTime, open, high, low, close, ...]: the close is the point.
  return rows.map((r) => ({ t: Number(r[0]), v: Number(r[4]) })).filter((p) => p.v > 0);
}

/** Daily reference rate of USD against one currency over a number of days, as the instrument's price. */
async function frankfurterDaily(symbol: string, days: number): Promise<HistoryPoint[]> {
  const cur = symbol === "GBPUSD" ? "GBP" : "JPY";
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const res = await fetch(`${FRANKFURTER}/${iso(start)}..${iso(end)}?base=USD&symbols=${cur}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { rates: Record<string, Record<string, number>> };
    return Object.entries(body.rates)
      .map(([day, r]) => ({ t: new Date(`${day}T00:00:00Z`).getTime(), v: symbol === "GBPUSD" ? 1 / r[cur] : r[cur] }))
      .filter((p) => p.v > 0 && Number.isFinite(p.v))
      .sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}

const RANGE_DAYS: Record<Range, number> = { "1D": 1, "1W": 7, "1M": 31, "3M": 92, "1Y": 366 };

/** Chart points of an instrument for a range. Empty when its history source is not answering. */
export async function getHistory(instrument: Instrument, range: Range): Promise<HistoryPoint[]> {
  try {
    if (instrument.binance) return await binanceKlines(instrument.binance, range);
    if (instrument.daily && range !== "1D" && range !== "1W") return await frankfurterDaily(instrument.symbol, RANGE_DAYS[range]);
    // short ranges of a daily rate (and anything without an outside source): our own stored prices
    const supabase = await createClient();
    const hours = range === "1D" ? 24 : 168;
    const { data } = await supabase.rpc("market_series", { p_symbol: instrument.symbol, p_hours: hours });
    return ((data ?? []) as { t: string; price: number | string }[]).map((r) => ({ t: new Date(r.t).getTime(), v: Number(r.price) }));
  } catch {
    return [];
  }
}

/** The lowest and highest price of the last 52 weeks, or null when the history is not available. */
export async function get52Week(instrument: Instrument): Promise<{ low: number; high: number } | null> {
  try {
    if (instrument.binance) {
      const res = await fetch(`${BINANCE}/klines?symbol=${instrument.binance}&interval=1d&limit=365`, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      const rows = (await res.json()) as unknown[][];
      const highs = rows.map((r) => Number(r[2]));
      const lows = rows.map((r) => Number(r[3]));
      if (!highs.length) return null;
      return { low: Math.min(...lows), high: Math.max(...highs) };
    }
    if (instrument.daily) {
      const pts = await frankfurterDaily(instrument.symbol, 366);
      if (pts.length < 20) return null;
      return { low: Math.min(...pts.map((p) => p.v)), high: Math.max(...pts.map((p) => p.v)) };
    }
  } catch {
    // fall through
  }
  return null;
}

export { instrumentBySymbol };
