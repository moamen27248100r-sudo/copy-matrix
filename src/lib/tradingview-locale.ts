import type { Locale } from "@/i18n/locales";

// TradingView's widgets only recognize a fixed locale list of their own;
// languages they don't support (confirmed: ur, bn, sw) fall back to English
// rather than passing an unrecognized code the widget would silently ignore
// in an unpredictable way. Shared by every TradingView embed on the platform.
export const TRADINGVIEW_LOCALES: Record<Locale, string> = {
  ar: "ar", en: "en", fr: "fr", es: "es", pt: "pt",
  zh: "zh_CN", hi: "hi_IN", id: "id_ID", vi: "vi_VN", th: "th_TH",
  ur: "en", bn: "en", sw: "en",
};
