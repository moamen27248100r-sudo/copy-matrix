import type { Locale } from "@/i18n/locales";
import { localeTag } from "./locale-format.ts";

// The settlement asset. Shown in full only where it is the real transfer currency
// (deposit / withdrawal pages, wallet addresses, networks); everywhere else amounts use "$".
export const CURRENCY = "USDT";

export type MoneyOptions = {
  /** Fraction digits when the amount has a real fraction (default 2). A whole amount never shows ".00". */
  decimals?: number;
  /** Prefix "+" for positive and "-" for negative values (P&L style). */
  signed?: boolean;
  /** Short form for big headline stats (AUM, totals): $1.25M, $850.4K. Values under 1,000 stay in full. */
  compact?: boolean;
};

// The one place amounts are formatted: "$10,000", "$2.31", "-$749.90", "$1.33K".
//   * a whole amount drops its fraction ("$10,000"), a real fraction keeps two digits ("$2.31");
//   * the sign goes before the dollar sign ("-$749.90");
//   * grouping/decimal separators follow the user's locale (Latin digits, like the rest of the app);
//   * the result is wrapped in a left-to-right isolate so sign, symbol and number keep their order
//     inside right-to-left (Arabic) text.
// Display only: stored and computed amounts are never changed by this.
export function formatMoney(value: number, locale: Locale, opts: MoneyOptions = {}): string {
  const { decimals = 2, signed = false, compact = false } = opts;
  const n = Number.isFinite(value) ? value : 0;
  const rounded = Number(Math.abs(n).toFixed(decimals));
  const useCompact = compact && rounded >= 1000;
  const whole = Number.isInteger(rounded);
  const digits = whole ? 0 : decimals;
  const abs = new Intl.NumberFormat(
    localeTag(locale),
    useCompact
      ? { notation: "compact", compactDisplay: "short", maximumFractionDigits: 2 }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  ).format(rounded);
  const sign = n < 0 && rounded !== 0 ? "-" : signed && n > 0 && rounded !== 0 ? "+" : "";
  return `⁦${sign}$${abs}⁩`;
}

// The same amount written in the transfer currency ("1,234.56 USDT"): only for deposit and
// withdrawal screens, where the user is sending or receiving actual USDT.
export function formatUsdt(value: number, locale: Locale, opts: MoneyOptions = {}): string {
  const { decimals = 2, signed = false, compact = false } = opts;
  const n = Number.isFinite(value) ? value : 0;
  const useCompact = compact && Math.abs(n) >= 1000;
  const abs = new Intl.NumberFormat(
    localeTag(locale),
    useCompact
      ? { notation: "compact", compactDisplay: "short", maximumFractionDigits: 2 }
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals },
  ).format(Math.abs(n));
  const rounded = Number(Math.abs(n).toFixed(decimals));
  const sign = n < 0 && rounded !== 0 ? "-" : signed && n > 0 && rounded !== 0 ? "+" : "";
  return `⁦${sign}${abs} ${CURRENCY}⁩`;
}

// Plain localized number (no currency) for prices and quantities.
export function formatNumber(value: number, locale: Locale, decimals = 2): string {
  return new Intl.NumberFormat(localeTag(locale), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
