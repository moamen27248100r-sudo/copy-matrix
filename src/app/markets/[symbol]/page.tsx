import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { InstrumentChart } from "@/components/markets/InstrumentChart";
import { TraderAvatar } from "@/components/TraderAvatar";
import { RiskFooter } from "@/components/RiskFooter";
import { formatPrice, instrumentBySymbol, parseSnapshot } from "@/lib/markets";
import { getMarketNewsFor, topicsForSymbols } from "@/lib/market-news";
import { localeTag } from "@/lib/locale-format";
import { nowMs } from "@/lib/now";
import { toggleWatch } from "@/app/markets/actions";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const inst = instrumentBySymbol(symbol);
  return { title: inst ? `${inst.label} | Copy Matrix` : "Copy Matrix" };
}

// One instrument: live price, 24-hour change, an interactive chart in the platform style, today
// range, the headlines that concern it and the leaders who trade it most.
export default async function InstrumentPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const inst = instrumentBySymbol(symbol);
  if (!inst) notFound();

  const t = await getTranslations("Markets");
  const td = await getTranslations("Dashboard");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/markets/${symbol}`)}`);

  const [{ data: snap }, { data: day }, { data: week }, { data: leaders }, { data: watch }, news] = await Promise.all([
    supabase.rpc("market_snapshot"),
    supabase.rpc("market_series", { p_symbol: symbol, p_hours: 24 }),
    supabase.rpc("market_series", { p_symbol: symbol, p_hours: 168 }),
    supabase.rpc("top_leaders_for_symbol", { p_symbol: symbol, p_limit: 5 }),
    supabase.from("market_watchlist").select("symbol").eq("user_id", user.id).eq("symbol", symbol).maybeSingle(),
    getMarketNewsFor(topicsForSymbols([symbol]), 5),
  ]);
  const row = parseSnapshot(snap).find((r) => r.symbol === symbol);
  const toPoints = (rows: unknown) =>
    ((rows ?? []) as { t: string; price: number | string }[]).map((r) => ({ t: new Date(r.t).getTime(), v: Number(r.price) }));

  const leaderRows = (leaders ?? []) as { provider_id: string; trades: number | string }[];
  const { data: cards } = leaderRows.length
    ? await supabase
        .from("provider_cards")
        .select("provider_id, display_name, avatar_url, rating_score")
        .in(
          "provider_id",
          leaderRows.map((l) => l.provider_id),
        )
    : { data: [] as { provider_id: string; display_name: string; avatar_url: string | null; rating_score: number | null }[] };
  const cardById = new Map((cards ?? []).map((c) => [c.provider_id, c]));

  const change = row?.change_pct ?? null;
  const starred = !!watch;
  const lo = row?.low_24h ?? null;
  const hi = row?.high_24h ?? null;
  const position = row && lo != null && hi != null && hi > lo ? Math.min(100, Math.max(0, ((row.price - lo) / (hi - lo)) * 100)) : null;

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
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6">
        <Link href="/discover?tab=markets" className="tap-44 inline-flex w-fit items-center gap-1.5 text-sm text-muted transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("backToMarkets")}
        </Link>

        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-page-title" dir="ltr">
              {inst.label}
            </h1>
            {row ? (
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3" dir="ltr">
                <span className="text-3xl font-bold tabular-nums">{formatPrice(row.price, inst.decimals)}</span>
                <span className={`text-sm font-semibold tabular-nums ${change == null ? "text-muted" : change >= 0 ? "text-success" : "text-danger"}`}>
                  {change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
                </span>
                <span className="text-xs text-muted">{t("last24h")}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">{t("noData")}</p>
            )}
          </div>
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
        </header>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <InstrumentChart day={toPoints(day)} week={toPoints(week)} decimals={inst.decimals} label={inst.label} />
        </section>

        {row && lo != null && hi != null && (
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">{t("dayRange")}</h2>
            <div className="flex items-center gap-3 text-xs tabular-nums" dir="ltr">
              <span>{formatPrice(lo, inst.decimals)}</span>
              <div className="relative h-1.5 flex-1 rounded-full bg-border">
                {position != null && (
                  <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${position}%` }} />
                )}
              </div>
              <span>{formatPrice(hi, inst.decimals)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-muted">
              <span>{t("low")}</span>
              <span>{t("high")}</span>
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t("relatedNews")}</h2>
            {news.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">{t("noNews")}</p>
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
            <h2 className="text-base font-semibold">{t("topTraders")}</h2>
            {leaderRows.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">{t("noTopTraders")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {leaderRows.map((l) => {
                  const c = cardById.get(l.provider_id);
                  if (!c) return null;
                  return (
                    <li key={l.provider_id}>
                      <Link
                        href={`/trader/${l.provider_id}`}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-accent/40"
                      >
                        <TraderAvatar providerId={l.provider_id} name={c.display_name} avatarUrl={c.avatar_url} ratingScore={c.rating_score} size={40} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.display_name}</span>
                        <span className="shrink-0 text-xs text-muted">{t("tradesIn30d", { count: Number(l.trades) })}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <RiskFooter />
      </main>
    </>
  );
}
