"use client";

import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/locales";
import { formatMoney, type MoneyOptions } from "@/lib/money";

// Client components: const money = useMoney(); money(1234.5) -> "1,234.50 USDT"
export function useMoney() {
  const locale = useLocale() as Locale;
  return (value: number, opts?: MoneyOptions) => formatMoney(value, locale, opts);
}
