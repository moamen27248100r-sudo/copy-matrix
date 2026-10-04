// Locale-neutral platform facts (name, official support email)
// used anywhere the app needs to say who it is or how to reach
// it, instead of that string being hand-typed again at each call site.
// Everything else (page copy, FAQ answers, legal sections) stays in
// next-intl's per-locale message files, where it belongs.
export const PLATFORM_NAME = "Copy Matrix";
export const SUPPORT_EMAIL = "support@copy-matrix.com";

// Balance every new demo account starts with (src/app/auth/actions.ts
// chooseAccountType).
export const DEMO_START_BALANCE = 10000;

// Instruments offered for trading, grouped as on the markets widget. The
// landing page facts and the markets table both read from here.
export const TRADABLE_SYMBOLS = {
  crypto: ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "BINANCE:SOLUSDT", "BINANCE:BNBUSDT", "BINANCE:XRPUSDT"],
  forex: ["OANDA:XAUUSD", "OANDA:EURUSD", "OANDA:GBPUSD", "OANDA:USDJPY"],
  indices: ["FOREXCOM:US30"],
} as const;
export const TRADABLE_SYMBOL_COUNT = Object.values(TRADABLE_SYMBOLS).reduce((n, l) => n + l.length, 0);

// TODO(owner): subscription fee is not defined anywhere in the project. Set
// this (e.g. "0$ / month") to show it on the landing facts strip and fee table.
export const SUBSCRIPTION_FEE_TEXT: string | null = null;
