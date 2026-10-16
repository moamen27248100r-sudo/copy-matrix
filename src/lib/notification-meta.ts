// How a notification looks in a list: which icon its type gets, how an asset symbol is written, and
// how long ago it happened. Kept apart from the component so each piece can be tested.

export type NotificationKind = "copy" | "market" | "security" | "verify" | "wallet" | "leader" | "alert" | "follow" | "other";

export function notificationKind(type: string): NotificationKind {
  if (type.startsWith("copy_") || type === "auto_stop_copy") return type === "auto_stop_copy" ? "alert" : "copy";
  if (type.startsWith("market_")) return "market";
  if (type.startsWith("security_")) return "security";
  if (type.startsWith("kyc_")) return "verify";
  if (type.startsWith("wallet_")) return "wallet";
  if (type.startsWith("lead_")) return "leader";
  if (type === "loss_alert" || type === "trade_integrity_alert") return "alert";
  if (type.startsWith("followed_")) return "follow";
  return "other";
}

const QUOTES = ["USDT", "USDC", "USD", "EUR", "GBP", "JPY", "BTC", "ETH"];

/** "ETHUSDT" -> "ETH/USDT", "EURUSD" -> "EUR/USD", "BINANCE:BTCUSDT" -> "BTC/USDT"; anything else is left as it is. */
export function prettySymbol(raw: unknown): string {
  let s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";
  if (s.includes("/")) return s;
  if (s.includes(":")) s = s.split(":").pop() ?? s;
  for (const q of QUOTES) {
    if (s.length > q.length && s.endsWith(q)) {
      const base = s.slice(0, -q.length);
      if (base.length >= 2 && base.length <= 6) return `${base}/${q}`;
    }
  }
  return s;
}

/** "5 minutes ago" in the customer's language; under a minute reads "now". */
export function relativeTime(iso: string, locale: string, now: number = Date.now()): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000); // negative = in the past
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
}
