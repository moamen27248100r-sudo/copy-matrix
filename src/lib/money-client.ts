"use client";

import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/locales";
import { formatMoney, formatUsdt, type MoneyOptions } from "@/lib/money";

// Client components: const money = useMoney(); money(1234.5) -> "$1,234.50"
export function useMoney() {
  const locale = useLocale() as Locale;
  return (value: number, opts?: MoneyOptions) => formatMoney(value, locale, opts);
}

// Deposit / withdrawal screens only: money(1234.5) -> "1,234.50 USDT"
export function useUsdt() {
  const locale = useLocale() as Locale;
  return (value: number, opts?: MoneyOptions) => formatUsdt(value, locale, opts);
}
