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

// A real gold-bar glyph (gradient bullion ingot, like the icon most
// trading platforms use for XAUUSD) instead of the generic 🥇 medal emoji.
function GoldBarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.1em] w-[1.1em]" aria-hidden="true">
      <defs>
        <linearGradient id="cm-gold-bar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff3c4" />
          <stop offset="45%" stopColor="#f0b90b" />
          <stop offset="100%" stopColor="#a9760a" />
        </linearGradient>
      </defs>
      <path
        d="M5 8.5 L8 6 H16 L19 8.5 L17 17 H7 Z"
        fill="url(#cm-gold-bar)"
        stroke="#7c5a06"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path d="M8 6 H16 L19 8.5 H5 Z" fill="#fff8dd" opacity="0.6" />
      <path d="M9.3 9.2 L14.7 9.2 L13.6 14.8 L10.4 14.8 Z" fill="#00000022" />
    </svg>
  );
}

// Renders as a real gold-bar SVG for XAUUSD (visually distinctive from the
// generic emoji set below) and falls back to the existing emoji glyph for
// every other symbol.
export function SymbolIcon({ symbol }: { symbol: string }) {
  if (symbol === "XAUUSD") return <GoldBarIcon />;
  return <>{symbolIcon(symbol)}</>;
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
