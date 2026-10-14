// The instruments the platform quotes (market_prices / price_history), with how each is shown.
// Codes are instrument symbols and stay as they are in every language.
export type Instrument = { symbol: string; label: string; kind: "forex" | "gold" | "crypto"; decimals: number };

export const INSTRUMENTS: Instrument[] = [
  { symbol: "XAUUSD", label: "XAU/USD", kind: "gold", decimals: 2 },
  { symbol: "EURUSD", label: "EUR/USD", kind: "forex", decimals: 4 },
  { symbol: "GBPUSD", label: "GBP/USD", kind: "forex", decimals: 4 },
  { symbol: "USDJPY", label: "USD/JPY", kind: "forex", decimals: 3 },
  { symbol: "BTCUSDT", label: "BTC/USDT", kind: "crypto", decimals: 2 },
  { symbol: "ETHUSDT", label: "ETH/USDT", kind: "crypto", decimals: 2 },
  { symbol: "BNBUSDT", label: "BNB/USDT", kind: "crypto", decimals: 2 },
  { symbol: "SOLUSDT", label: "SOL/USDT", kind: "crypto", decimals: 2 },
  { symbol: "XRPUSDT", label: "XRP/USDT", kind: "crypto", decimals: 4 },
];

export const instrumentBySymbol = (symbol: string): Instrument | undefined => INSTRUMENTS.find((i) => i.symbol === symbol);

export function formatPrice(value: number, decimals: number): string {
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
  }));
}
