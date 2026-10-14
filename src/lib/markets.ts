// The instruments the platform quotes (market_prices / price_history), with how each is shown.
// An instrument is listed only when it has a working price source: crypto from the Binance public
// ticker every 10 seconds, gold and the euro from the Binance gold / euro pairs, GBP/USD and USD/JPY
// from the daily ECB reference rate (Frankfurter). Codes and brand names stay as they are in every
// language.

export type InstrumentKind = "crypto" | "forex" | "commodity";
/** What the instrument is, for the one-line description (translated under Markets.type_*). */
export type AboutType =
  | "store_of_value"
  | "smart_contracts"
  | "exchange_token"
  | "payments"
  | "meme"
  | "oracle"
  | "defi"
  | "interop"
  | "gold"
  | "forex";

export type Instrument = {
  symbol: string;
  /** "BTC/USDT" */
  label: string;
  /** "Bitcoin" -- a brand / market name, not translated */
  name: string;
  kind: InstrumentKind;
  decimals: number;
  about: AboutType;
  /** the short mark inside the round icon, and its colours */
  glyph: string;
  tone: string;
  /** the Binance pair that gives its history and volume (undefined: no Binance history) */
  binance?: string;
  /** a price that is a daily reference rate, not a live quote */
  daily?: boolean;
};

const crypto = (symbol: string, name: string, decimals: number, about: AboutType, glyph: string, tone: string): Instrument => ({
  symbol: `${symbol}USDT`,
  label: `${symbol}/USDT`,
  name,
  kind: "crypto",
  decimals,
  about,
  glyph,
  tone,
  binance: `${symbol}USDT`,
});

export const INSTRUMENTS: Instrument[] = [
  crypto("BTC", "Bitcoin", 2, "store_of_value", "₿", "text-orange-400 bg-orange-500/10"),
  crypto("ETH", "Ethereum", 2, "smart_contracts", "Ξ", "text-indigo-300 bg-indigo-500/10"),
  crypto("BNB", "BNB", 2, "exchange_token", "B", "text-yellow-400 bg-yellow-500/10"),
  crypto("SOL", "Solana", 2, "smart_contracts", "S", "text-emerald-300 bg-emerald-500/10"),
  crypto("XRP", "XRP", 4, "payments", "X", "text-slate-300 bg-slate-500/10"),
  crypto("ADA", "Cardano", 4, "smart_contracts", "A", "text-sky-300 bg-sky-500/10"),
  crypto("DOGE", "Dogecoin", 5, "meme", "Ð", "text-amber-300 bg-amber-500/10"),
  crypto("TRX", "TRON", 4, "payments", "T", "text-red-400 bg-red-500/10"),
  crypto("AVAX", "Avalanche", 3, "smart_contracts", "A", "text-rose-400 bg-rose-500/10"),
  crypto("LINK", "Chainlink", 3, "oracle", "L", "text-blue-400 bg-blue-500/10"),
  crypto("DOT", "Polkadot", 3, "interop", "D", "text-pink-400 bg-pink-500/10"),
  crypto("LTC", "Litecoin", 2, "payments", "Ł", "text-zinc-300 bg-zinc-500/10"),
  crypto("NEAR", "NEAR Protocol", 3, "smart_contracts", "N", "text-teal-300 bg-teal-500/10"),
  crypto("SUI", "Sui", 4, "smart_contracts", "S", "text-cyan-300 bg-cyan-500/10"),
  crypto("UNI", "Uniswap", 3, "defi", "U", "text-fuchsia-400 bg-fuchsia-500/10"),
  crypto("BCH", "Bitcoin Cash", 2, "payments", "B", "text-green-400 bg-green-500/10"),
  crypto("ATOM", "Cosmos", 3, "interop", "A", "text-violet-300 bg-violet-500/10"),
  crypto("XLM", "Stellar", 4, "payments", "X", "text-lime-300 bg-lime-500/10"),
  crypto("TON", "Toncoin", 3, "smart_contracts", "T", "text-sky-400 bg-sky-500/10"),
  crypto("SHIB", "Shiba Inu", 8, "meme", "S", "text-orange-300 bg-orange-500/10"),
  { symbol: "XAUUSD", label: "XAU/USD", name: "Gold", kind: "commodity", decimals: 2, about: "gold", glyph: "Au", tone: "text-amber-400 bg-amber-500/10", binance: "PAXGUSDT" },
  { symbol: "EURUSD", label: "EUR/USD", name: "Euro / US Dollar", kind: "forex", decimals: 4, about: "forex", glyph: "€", tone: "text-blue-400 bg-blue-500/10", binance: "EURUSDT" },
  { symbol: "GBPUSD", label: "GBP/USD", name: "British Pound / US Dollar", kind: "forex", decimals: 4, about: "forex", glyph: "£", tone: "text-sky-400 bg-sky-500/10", daily: true },
  { symbol: "USDJPY", label: "USD/JPY", name: "US Dollar / Japanese Yen", kind: "forex", decimals: 3, about: "forex", glyph: "¥", tone: "text-rose-400 bg-rose-500/10", daily: true },
];

export const instrumentBySymbol = (symbol: string): Instrument | undefined => INSTRUMENTS.find((i) => i.symbol === symbol);

/** The six instruments every new customer starts watching (they can change the list). */
export const DEFAULT_WATCHLIST = ["BTCUSDT", "ETHUSDT", "XAUUSD", "EURUSD", "SOLUSDT", "BNBUSDT"] as const;

/** A live price older than this is not shown: its source is not answering. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export function formatPrice(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export type SnapshotRow = {
  symbol: string;
  price: number;
  open_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
  change_pct: number | null;
  spark: number[] | null;
  updated_at: string | null;
  source_date: string | null;
};

/** Rows of the market_snapshot() RPC with numbers as numbers. */
export function parseSnapshot(rows: unknown): SnapshotRow[] {
  const n = (v: unknown) => (v == null ? null : Number(v));
  return ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
    symbol: String(r.symbol),
    price: Number(r.price),
    open_24h: n(r.open_24h),
    high_24h: n(r.high_24h),
    low_24h: n(r.low_24h),
    change_pct: n(r.change_pct),
    spark: Array.isArray(r.spark) ? (r.spark as unknown[]).map(Number) : null,
    updated_at: r.updated_at == null ? null : String(r.updated_at),
    source_date: r.source_date == null ? null : String(r.source_date),
  }));
}

/** Only instruments we list, with a price whose source is working (never a stale or unknown one). */
export function liveRows(rows: SnapshotRow[], now = Date.now()): (SnapshotRow & { instrument: Instrument })[] {
  const out: (SnapshotRow & { instrument: Instrument })[] = [];
  for (const r of rows) {
    const instrument = instrumentBySymbol(r.symbol);
    if (!instrument || !(r.price > 0)) continue;
    const at = r.updated_at ? new Date(r.updated_at).getTime() : 0;
    if (!at || now - at > STALE_AFTER_MS) continue;
    out.push({ ...r, instrument });
  }
  return out;
}
