import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/locales";
import { formatMoney, type MoneyOptions } from "@/lib/money";

// Server components / actions: const money = await getMoney();
export async function getMoney() {
  const locale = (await getLocale()) as Locale;
  return (value: number, opts?: MoneyOptions) => formatMoney(value, locale, opts);
}
