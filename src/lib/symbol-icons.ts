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
