import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMarketNewsFor, topicsForSymbols } from "@/lib/market-news";
import { localeTag } from "@/lib/locale-format";
import { nowMs } from "@/lib/now";
import type { Locale } from "@/i18n/locales";

// Latest headlines for the markets the customer trades: the instruments of their open positions
// and the main instrument of every trader they copy (all markets when there is neither). Real
// headlines from Investing.com's RSS feeds with the wire source and time; the section hides itself
// when no feed answers -- nothing is ever generated.
export async function MarketNewsSection({ providerIds, openSymbols }: { providerIds: string[]; openSymbols: string[] }) {
  const t = await getTranslations("Dashboard");
  const locale = (await getLocale()) as Locale;

  const symbols = [...openSymbols];
  if (providerIds.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.from("provider_cards").select("primary_symbol").in("provider_id", providerIds);
    for (const r of data ?? []) if (r.primary_symbol) symbols.push(r.primary_symbol);
  }

  const items = await getMarketNewsFor(topicsForSymbols(symbols), 5);
  if (items.length === 0) return null;

  const rtf = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  const ago = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - nowMs()) / 60000);
    if (Math.abs(mins) < 60) return rtf.format(Math.min(mins, 0), "minute");
    const hours = Math.round(mins / 60);
    if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
    return rtf.format(Math.round(hours / 24), "day");
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("newsTitle")}</h2>
        <a
          href="https://www.investing.com/news/"
          target="_blank"
          rel="noopener noreferrer"
          className="tap-44 text-sm text-accent hover:underline"
        >
          {t("newsViewAll")}
        </a>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {items.map((n) => (
          <li key={n.link}>
            <a
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 flex-col gap-1 px-4 py-3 text-start transition hover:bg-white/[0.03]"
            >
              <span dir="auto" className="text-sm font-medium leading-snug">
                {n.title}
              </span>
              <span className="text-xs text-muted">
                {t("newsSourceLine", { source: n.source, time: ago(n.pubDate) })}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted">{t("newsNote")}</p>
    </section>
  );
}
