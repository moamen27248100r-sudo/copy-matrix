import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { formatMoney, formatUsdt, type MoneyOptions } from "@/lib/money";

// Server components / actions: const money = await getMoney();  money(1234.5) -> "$1,234.50"
export async function getMoney() {
  const locale = (await getLocale()) as Locale;
  return (value: number, opts?: MoneyOptions) => formatMoney(value, locale, opts);
}

// Deposit / withdrawal screens only: "1,234.50 USDT"
export async function getUsdt() {
  const locale = (await getLocale()) as Locale;
  return (value: number, opts?: MoneyOptions) => formatUsdt(value, locale, opts);
}
