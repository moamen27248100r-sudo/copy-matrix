import type { Locale } from "@/i18n/locales";
import { localeTag } from "@/lib/locale-format";

export const CURRENCY = "USDT";

export type MoneyOptions = {
  /** Fraction digits (default 2, like "1,234.56 USDT"). */
  decimals?: number;
  /** Prefix "+" for positive and "-" for negative values (P&L style). */
  signed?: boolean;
  /** Short form for big headline stats (AUM, totals): 1.25M USDT, 850.4K USDT. Values under 1,000 stay in full. */
  compact?: boolean;
};

// The one place amounts are formatted: "1,234.56 USDT". Grouping/decimal
// separators follow the user's locale (Latin digits, like the rest of the app)
// and the result is wrapped in a bidi isolate so sign, number and currency stay
// in order inside right-to-left text.
export function formatMoney(value: number, locale: Locale, opts: MoneyOptions = {}): string {
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
