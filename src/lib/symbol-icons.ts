export const SYMBOL_ICONS: Record<string, string> = {
  BTCUSDT: "₿",
  ETHUSDT: "Ξ",
  SOLUSDT: "◎",
  BNBUSDT: "🔶",
  XRPUSDT: "✕",
  XAUUSD: "🥇",
  EURUSD: "🇪🇺",
  GBPUSD: "🇬🇧",
  USDJPY: "🇯🇵",
  US30: "📊",
};

export function symbolIcon(symbol: string): string {
  return SYMBOL_ICONS[symbol] ?? "🔹";
}

// Fixed, distinctive color per instrument so the same asset always renders
// the same color across every trader's page, instead of a color that shifts
// with array position.
export const SYMBOL_COLORS: Record<string, string> = {
  XAUUSD: "#eab308",
  USDJPY: "#38bdf8",
  BTCUSDT: "#8b5cf6",
  GBPUSD: "#ec4899",
  EURUSD: "#22c55e",
  ETHUSDT: "#6366f1",
  SOLUSDT: "#14b8a6",
  BNBUSDT: "#fb923c",
  XRPUSDT: "#64748b",
  US30: "#0891b2",
};

export const OTHER_COLOR = "#cbd5e1";

export function symbolColor(symbol: string): string {
  return SYMBOL_COLORS[symbol] ?? OTHER_COLOR;
}

export const SYMBOL_FULL_NAMES: Record<string, string> = {
  XAUUSD: "Gold vs US Dollar",
  EURUSD: "Euro vs US Dollar",
  GBPUSD: "British Pound vs US Dollar",
  USDJPY: "US Dollar vs Japanese Yen",
  BTCUSDT: "Bitcoin vs Tether",
  ETHUSDT: "Ethereum vs Tether",
  SOLUSDT: "Solana vs Tether",
  BNBUSDT: "BNB vs Tether",
  XRPUSDT: "XRP vs Tether",
  US30: "Dow Jones Industrial Average",
};

export function symbolFullName(symbol: string): string {
  return SYMBOL_FULL_NAMES[symbol] ?? symbol;
}

export const SYMBOL_FULL_NAMES_AR: Record<string, string> = {
  XAUUSD: "الذهب",
  EURUSD: "اليورو مقابل الدولار",
  GBPUSD: "الجنيه الإسترليني مقابل الدولار",
  USDJPY: "الدولار مقابل الين الياباني",
  BTCUSDT: "البيتكوين",
  ETHUSDT: "الإيثيريوم",
  SOLUSDT: "سولانا",
  BNBUSDT: "البي إن بي",
  XRPUSDT: "الريبل",
  US30: "مؤشر داو جونز الصناعي",
};

export function symbolFullNameAr(symbol: string): string {
  return SYMBOL_FULL_NAMES_AR[symbol] ?? symbol;
}

export const SYMBOL_TRADINGVIEW_TICKERS: Record<string, string> = {
  XAUUSD: "OANDA:XAUUSD",
  EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD",
  USDJPY: "OANDA:USDJPY",
  BTCUSDT: "BINANCE:BTCUSDT",
  ETHUSDT: "BINANCE:ETHUSDT",
  SOLUSDT: "BINANCE:SOLUSDT",
  BNBUSDT: "BINANCE:BNBUSDT",
  XRPUSDT: "BINANCE:XRPUSDT",
  US30: "FOREXCOM:DJI",
};

export function symbolTradingViewTicker(symbol: string): string {
  return SYMBOL_TRADINGVIEW_TICKERS[symbol] ?? "OANDA:XAUUSD";
}
