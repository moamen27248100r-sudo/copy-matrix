// Static, illustrative content for the landing-page phone showcase
// (src/components/showcase). Nothing here is read from the database --
// it exists purely so the mockup screens have realistic-looking numbers
// without a network round trip. Keep every literal value here, not
// inline in a component, so the showcase can be re-tuned in one place.

export type OpenTrade = {
  symbol: string;
  side: "buy" | "sell";
  lot: number;
  pnl: number;
};

export type CopiedTrader = {
  name: string;
  allocationPct: number;
  returnPct: number;
  active: boolean;
};

export type TradeNotificationSeed = {
  symbol: string;
  pnl: number;
};

export const showcaseTrader = {
  name: "أحمد الشمري",
  bio: "متخصص في الذهب والعملات",
  verified: true,
  return12mPct: 86.4,
  winRatePct: 72,
  maxDrawdownPct: -11.2,
  activeCopiers: 1284,
  riskLevel: "متوسطة" as const,
  // 12 monthly equity points, normalized 0-100 for the SVG chart.
  monthlyEquity: [22, 28, 26, 34, 31, 40, 46, 42, 55, 60, 58, 72],
};

export const showcaseOpenTrades: OpenTrade[] = [
  { symbol: "XAUUSD", side: "buy", lot: 0.5, pnl: 186.4 },
  { symbol: "BTCUSDT", side: "buy", lot: 0.02, pnl: 142.1 },
  { symbol: "EURUSD", side: "sell", lot: 1.0, pnl: -38.2 },
  { symbol: "NAS100", side: "buy", lot: 0.3, pnl: 122.3 },
];

export const showcasePortfolio = {
  balance: 10842.5,
  monthlyChangePct: 8.6,
  // last 6 months, one negative for realism
  monthlyBars: [4.2, 6.8, -3.1, 9.4, 7.2, 8.6],
};

export const showcaseCopiedTraders: CopiedTrader[] = [
  { name: "أحمد الشمري", allocationPct: 45, returnPct: 18.2, active: true },
  { name: "سارة المطيري", allocationPct: 30, returnPct: 9.6, active: true },
  { name: "يوسف علي", allocationPct: 25, returnPct: -2.4, active: false },
];

export const showcaseFloatingStats = {
  topTrader: { name: "أحمد الشمري", monthlyReturnPct: 18.2 },
  activeCopiers: 12480,
  tradesToday: 3214,
};

export const showcaseNotifications: TradeNotificationSeed[] = [
  { symbol: "XAUUSD", pnl: 140 },
  { symbol: "BTCUSDT", pnl: 320 },
  { symbol: "EURUSD", pnl: -45 },
  { symbol: "ETHUSDT", pnl: 210 },
  { symbol: "GBPUSD", pnl: 85 },
  { symbol: "USDJPY", pnl: -30 },
  { symbol: "XAGUSD", pnl: 65 },
  { symbol: "NAS100", pnl: 190 },
];

export const showcaseDisclaimer =
  "صورة توضيحية للمنصة. التداول ينطوي على مخاطر، والأداء السابق لا يضمن النتائج المستقبلية.";
