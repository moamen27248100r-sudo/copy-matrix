import { getLocale, getTranslations } from "next-intl/server";
import { getMarketNewsFor, topicsForSymbols, type NewsTopic } from "@/lib/market-news";
import { formatRelativeTime } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

// Headlines for the markets the customer follows (their watchlist), or for all three if they follow
// none: the publisher's own RSS headlines, with the real source and time, linking out.
export async function HomeNews({ symbols, limit = 4 }: { symbols: string[]; limit?: number }) {
  const t = await getTranslations("Dashboard");
  const locale = (await getLocale()) as Locale;
  const topics: NewsTopic[] = symbols.length ? topicsForSymbols(symbols) : ["crypto", "gold", "forex"];
  const news = await getMarketNewsFor(topics.length ? topics : ["crypto", "gold", "forex"], limit);
  if (news.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title">{t("marketNewsTitle")}</h2>
      <ul className="flex flex-col divide-y divide-border rounded-[20px] border border-border bg-surface">
        {news.map((n) => (
          <li key={n.link}>
            <a href={n.link} target="_blank" rel="noopener noreferrer" dir="auto" className="flex min-h-14 flex-col gap-1 px-4 py-3 text-start transition hover:bg-white/[0.03]">
              <span className="text-sm font-medium leading-snug">{n.title}</span>
              <span className="text-xs text-muted">
                {n.source === "Investing.com"
                  ? t("newsSourceOnly", { source: n.source, time: formatRelativeTime(n.pubDate, locale) })
                  : t("newsSourceLine", { source: n.source, time: formatRelativeTime(n.pubDate, locale) })}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
