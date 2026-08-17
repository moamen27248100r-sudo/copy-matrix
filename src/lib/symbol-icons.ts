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
