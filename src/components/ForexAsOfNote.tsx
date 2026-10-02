"use client";

import { useLocale, useTranslations } from "next-intl";
import { localeTag } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

// Forex rates come from a once-a-day ECB publication, not a live feed; this
// small label keeps clients from reading them as tick-by-tick prices.
export function ForexAsOfNote({ asOf }: { asOf: string | undefined }) {
  const t = useTranslations("LivePrices");
  const locale = useLocale() as Locale;
  const date = asOf
    ? new Date(`${asOf}T00:00:00Z`).toLocaleDateString(localeTag(locale), { month: "short", day: "numeric", timeZone: "UTC" })
    : null;
  return (
    <span className="block text-[10px] font-normal text-muted">
      {date ? t("forexDaily", { date }) : t("forexDailyNoDate")}
    </span>
  );
}
