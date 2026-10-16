import Link from "next/link";
import { getSparklines } from "@/lib/sparklines";
import { LeaderCard } from "@/components/LeaderCard";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { InstrumentChart, LivePrice } from "@/components/markets/InstrumentChart";
import { InstrumentIcon } from "@/components/markets/MarketsBoard";
import { RiskFooter } from "@/components/RiskFooter";
import { formatPrice, instrumentBySymbol, liveRows } from "@/lib/markets";
import { get52Week, getHistory, getSnapshot, getVolumes } from "@/lib/market-data";
import { getMarketNewsFor, topicsForSymbols } from "@/lib/market-news";
import { localeTag } from "@/lib/locale-format";
import { nowMs } from "@/lib/now";
import { toggleWatch } from "@/app/markets/actions";
import { PriceAlerts } from "@/components/markets/PriceAlerts";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const inst = instrumentBySymbol(symbol);
  return { title: inst ? `${inst.label} | Copy Matrix` : "Copy Matrix" };
}

const compactVolume = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString("en-US")}`);

function RangeBar({ lo, hi, price, decimals }: { lo: number; hi: number; price: number; decimals: number }) {
  const position = hi > lo ? Math.min(100, Math.max(0, ((price - lo) / (hi - lo)) * 100)) : 50;
  return (
    <div className="flex items-center gap-3 text-xs tabular-nums" dir="ltr">
      <span>{formatPrice(lo, decimals)}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-border">
        <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${position}%` }} />
      </div>
      <span>{formatPrice(hi, decimals)}</span>
    </div>
  );
}

// One instrument: live price (refreshing without a reload), an interactive chart with 1D | 1W | 1M |
// 3M | 1Y, today's and the 52-week range, the volume for crypto, a short description, the headlines
// that concern it and the leaders who trade it most. An instrument whose price source is not
// answering is not shown at all.
export default async function InstrumentPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ alert?: string }> }) {
  const { symbol } = await params;
  const { alert } = await searchParams;
  const inst = instrumentBySymbol(symbol);
  if (!inst) notFound();

  const t = await getTranslations("Markets");
  const td = await getTranslations("Dashboard");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Open to visitors too (the footer links here); the watchlist star and price alerts need an account.

  const [snapshot, volumes, initial, range52, { data: leaders }, { data: watch }, news] = await Promise.all([
    getSnapshot(),
    inst.kind === "crypto" ? getVolumes() : Promise.resolve({} as Awaited<ReturnType<typeof getVolumes>>),
    getHistory(inst, "1D"),
    get52Week(inst),
    supabase.rpc("top_leaders_for_symbol", { p_symbol: symbol, p_limit: 5 }),
    user ? supabase.from("market_watchlist").select("symbol").eq("user_id", user.id).eq("symbol", symbol).maybeSingle() : Promise.resolve({ data: null }),
    getMarketNewsFor(topicsForSymbols([symbol]), 5),
  ]);
  const row = liveRows(snapshot).find((r) => r.symbol === symbol);
  if (!row) notFound();

  const leaderRows = (leaders ?? []) as { provider_id: string; trades: number | string }[];
  const { data: cards } = leaderRows.length
    ? await supabase
        .from("provider_cards")
        .select("*")
        .in(
          "provider_id",
          leaderRows.map((l) => l.provider_id),
        )
    : { data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardById = new Map(((cards ?? []) as any[]).map((c) => [String(c.provider_id), c]));
  const spark = await getSparklines(supabase, leaderRows.map((l) => l.provider_id));

  const starred = !!watch;
  const volume = volumes[symbol]?.quoteVolume ?? null;
  const lo = row.low_24h;
  const hi = row.high_24h;
  const about = `${inst.name} (${inst.label}) — ${t(`type_${inst.about}`)}. ${inst.daily ? t("source_ecb") : t("source_binance")}`;

  const rtf = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  const ago = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - nowMs()) / 60000);
    if (Math.abs(mins) < 60) return rtf.format(Math.min(mins, 0), "minute");
    const hours = Math.round(mins / 60);
    if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
    return rtf.format(Math.round(hours / 24), "day");
  };

  return (
    <>
      <AppNav />
      <main className={`mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 ${user ? "pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6" : ""}`}>
        {user && (
          <Link href="/discover?tab=markets" className="tap-44 inline-flex w-fit items-center gap-1.5 text-sm text-muted transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("backToMarkets")}
        </Link>
        )}

        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <InstrumentIcon glyph={inst.glyph} toneClass={inst.tone} size="h-12 w-12" />
            <div className="min-w-0">
              <h1 className="text-page-title" dir="ltr">
                {inst.label}
              </h1>
              <p className="text-sm text-muted" dir="ltr">
                {inst.name}
              </p>
              <LivePrice symbol={symbol} price={row.price} change={row.change_pct} decimals={inst.decimals} daily={!!inst.daily} />
            </div>
          </div>
          {user && (
          <form action={toggleWatch}>
            <input type="hidden" name="symbol" value={symbol} />
            <input type="hidden" name="returnTo" value={`/markets/${symbol}`} />
            <button
              type="submit"
              aria-pressed={starred}
              className="tap-44 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-warning/50"
            >
              <Star className={`h-4 w-4 ${starred ? "fill-warning text-warning" : ""}`} aria-hidden="true" />
              {starred ? t("unwatch") : t("watch")}
            </button>
          </form>
          )}
        </header>

        <section className="rounded-[20px] border border-border bg-surface p-5">
          <InstrumentChart symbol={symbol} initial={initial} decimals={inst.decimals} label={inst.label} />
        </section>

        {user && <PriceAlerts userId={user.id} symbol={symbol} price={row.price} decimals={inst.decimals} result={alert} locale={locale} />}

        <div className="grid gap-4 sm:grid-cols-2">
          {lo != null && hi != null && (
            <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-5">
              <h2 className="text-section-title">{t("dayRange")}</h2>
              <RangeBar lo={lo} hi={hi} price={row.price} decimals={inst.decimals} />
              <div className="flex justify-between text-xs text-muted">
                <span>{t("low")}</span>
                <span>{t("high")}</span>
              </div>
            </section>
          )}
          {range52 && (
            <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-5">
              <h2 className="text-section-title">{t("range52")}</h2>
              <RangeBar lo={range52.low} hi={range52.high} price={row.price} decimals={inst.decimals} />
              <div className="flex justify-between text-xs text-muted">
                <span>{t("low")}</span>
                <span>{t("high")}</span>
              </div>
            </section>
          )}
          {volume != null && (
            <section className="flex flex-col gap-1 rounded-[20px] border border-border bg-surface p-5">
              <h2 className="text-section-title">{t("volume24h")}</h2>
              <p dir="ltr" className="text-xl font-bold tabular-nums">
                {compactVolume(volume)}
              </p>
            </section>
          )}
        </div>

        <section className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-5">
          <h2 className="text-section-title">{t("aboutTitle")}</h2>
          <p className="text-sm leading-relaxed text-muted">{about}</p>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <h2 className="text-section-title">{t("relatedNews")}</h2>
            {news.length === 0 ? (
              <p className="rounded-[20px] border border-border bg-surface p-5 text-sm text-muted">{t("noNews")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
                {news.map((n) => (
                  <li key={n.link}>
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="auto"
                      className="flex min-h-14 flex-col gap-1 px-4 py-3 text-start transition hover:bg-white/[0.03]"
                    >
                      <span className="text-sm font-medium leading-snug">{n.title}</span>
                      <span className="text-xs text-muted">
                        {n.source === "Investing.com"
                          ? td("newsSourceOnly", { source: n.source, time: ago(n.pubDate) })
                          : td("newsSourceLine", { source: n.source, time: ago(n.pubDate) })}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-section-title">{t("topTraders")}</h2>
            {leaderRows.length === 0 ? (
              <p className="rounded-[20px] border border-border bg-surface p-5 text-sm text-muted">{t("noTopTraders")}</p>
            ) : (
              <div className="no-scrollbar -mx-6 flex gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
                {leaderRows.map((l) => {
                  const c = cardById.get(l.provider_id);
                  if (!c) return null;
                  return <LeaderCard key={l.provider_id} provider={c} copyHref={user ? `/trader/${l.provider_id}#copy` : `/signup?next=${encodeURIComponent(`/trader/${l.provider_id}#copy`)}`} sparkline={spark[l.provider_id]} />;
                })}
              </div>
            )}
          </section>
        </div>

        <RiskFooter />
      </main>
    </>
  );
}
