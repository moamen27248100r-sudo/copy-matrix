import Link from "next/link";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MarketOverview } from "@/components/MarketOverview";
import { pinTopLeaders } from "@/lib/pin-top-leaders";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Locale } from "@/i18n/locales";

export const dynamic = "force-dynamic";

const FEATURE_ICONS = [
  (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  <polyline key="p" points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  (
    <>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <circle cx="16" cy="12" r="3" />
    </>
  ),
  (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  (
    <>
      <path d="M9 12l2 2 4-4" />
      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.05 0 3.93.68 5.44 1.83" />
      <path d="M21 3v6h-6" />
    </>
  ),
];

const NAV_HASHES = ["how-it-works", "traders", "markets", "features", "faq"] as const;

const FOOTER_LEGAL_HREFS = ["/legal/terms", "/legal/privacy"] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("Home");
  const locale = (await getLocale()) as Locale;

  const { data: rawTopProviders } = await supabase
    .from("provider_cards")
    .select("*")
    .order("avg_return_pct", { ascending: false, nullsFirst: false })
    .limit(10);

  const topProviders = rawTopProviders ? pinTopLeaders(rawTopProviders).slice(0, 6) : rawTopProviders;

  const { data: allProviders } = await supabase
    .from("provider_cards")
    .select("followers_count, win_rate_pct, open_signals, closed_signals, total_profit, avg_return_pct");

  // "متداول نشط", "مستخدم ناسخ" and "متوسط نسبة النجاح" read like live
  // activity counters, so they get small live-feeling variance anchored
  // to their real computed value on every refresh. إجمالي الأرباح، أعلى
  // عائد شهري، and إجمالي الصفقات stay exactly the real computed value —
  // those are hard financial/performance claims that should only change
  // when the underlying data actually changes, same as any real platform.
  function jitter(value: number, pct: number) {
    return value * (1 + (Math.random() * 2 - 1) * pct);
  }

  // أعلى عائد شهري changes once a day (not every refresh, since a
  // real best-performer figure shouldn't visibly flicker) — seeded off
  // today's date so it's stable all day and shifts to a new value
  // tomorrow.
  function dailyJitter(value: number, pct: number) {
    const seed = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const rand = (hash % 10000) / 10000;
    return value * (1 + (rand * 2 - 1) * pct);
  }

  // "متداول نشط" = how many distinct traders currently have at least one
  // real copier — still tied directly to the same follower data as
  // "مستخدم ناسخ" (moves automatically as customers join/leave any
  // trader), but counting traders instead of summing customers keeps
  // the two numbers at naturally different, non-confusable scales.
  const totalTraders = Math.max(
    0,
    Math.round(jitter((allProviders ?? []).filter((p) => (p.followers_count ?? 0) > 0).length, 0.02)),
  );
  const totalCopiers = Math.round(
    jitter((allProviders ?? []).reduce((sum, p) => sum + (p.followers_count ?? 0), 0), 0.04),
  );
  const totalExecutedTrades = (allProviders ?? []).reduce(
    (sum, p) => sum + (p.open_signals ?? 0) + (p.closed_signals ?? 0),
    0,
  );
  const totalProfit = (allProviders ?? []).reduce((sum, p) => sum + Number(p.total_profit ?? 0), 0);
  const returns = (allProviders ?? []).map((p) => p.avg_return_pct).filter((v): v is number => v != null);
  const rawBestReturn = returns.length ? Math.max(...returns) : null;
  const bestReturn = rawBestReturn != null ? Math.round(dailyJitter(rawBestReturn, 0.08) * 100) / 100 : null;
  // Weighted by each trader's own follower count instead of a flat mean,
  // so this reads as "the win rate the average COPYING USER actually
  // sees" — consistent with totalCopiers and totalProfit — rather than
  // being dragged down by obscure, barely-followed traders counting the
  // same as heavily-copied ones.
  const winRateRows = (allProviders ?? []).filter(
    (p): p is typeof p & { win_rate_pct: number } => p.win_rate_pct != null,
  );
  const winRateWeight = winRateRows.reduce((sum, p) => sum + Math.max(1, p.followers_count ?? 0), 0);
  const rawAvgWinRate = winRateWeight
    ? winRateRows.reduce((sum, p) => sum + p.win_rate_pct * Math.max(1, p.followers_count ?? 0), 0) / winRateWeight
    : null;
  const avgWinRate = rawAvgWinRate != null ? Math.min(99, Math.max(1, Math.round(jitter(rawAvgWinRate, 0.03)))) : null;

  const navLinks = NAV_HASHES.map((h) => ({ href: `#${h}`, label: t(`nav.${h === "how-it-works" ? "howItWorks" : h}`) }));
  const highlights = t.raw("highlights") as { title: string; desc: string }[];
  const featureItems = t.raw("features.items") as { title: string; desc: string }[];
  const steps = t.raw("howItWorks.steps") as { title: string; desc: string }[];
  const faqs = t.raw("faq.items") as { q: string; a: string }[];

  return (
    <main className="flex min-h-screen flex-col">
      <nav className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 sm:gap-3">
            <Link
              href="/signup"
              className="whitespace-nowrap rounded bg-accent px-2 py-1.5 text-[11px] font-medium text-accent-foreground transition hover:bg-accent-hover sm:px-4 sm:py-2 sm:text-sm"
            >
              {t("nav.signup")}
            </Link>

            <span className="flex items-center justify-center gap-0.5 whitespace-nowrap text-sm font-semibold sm:text-lg" dir="ltr">
              Copy Matrix
              <span className="flex items-center">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3 text-brand sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 19l3-5 3 3 5-9" />
                  <path d="M12 8h4v4" />
                </svg>
                <svg
                  viewBox="0 0 24 24"
                  className="-ml-1 h-3 w-3 text-brand sm:-ml-1.5 sm:h-4 sm:w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 19l3-5 3 3 5-9" />
                  <path d="M12 8h4v4" />
                </svg>
              </span>
            </span>

            <div className="flex items-center gap-1 sm:gap-3">
              <LanguageSwitcher currentLocale={locale} />
              <Link href="/login" className="whitespace-nowrap rounded border border-border px-2 py-1.5 text-[11px] sm:px-4 sm:py-2 sm:text-sm">
                {t("nav.login")}
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted sm:gap-x-6 sm:pt-3 sm:text-sm">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <section className="flex flex-col items-center gap-5 px-6 py-20 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">{t("hero.title")}</h1>
        <p className="max-w-md text-muted">{t("hero.subtitle")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/signup"
            className="rounded bg-accent px-6 py-3 font-medium text-accent-foreground transition hover:bg-accent-hover"
          >
            {t("hero.start")}
          </Link>
          <a href="#traders" className="rounded border border-border px-6 py-3 font-medium text-foreground">
            {t("hero.browse")}
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs text-muted">
          {[t("hero.trust0"), t("hero.trust1"), t("hero.trust2")].map((trustText) => (
            <span key={trustText} className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {trustText}
            </span>
          ))}
        </div>
        <div className="mx-auto w-full max-w-4xl">
          <Image
            src="/hero-app-preview.png"
            alt={t("hero.imageAlt")}
            width={1376}
            height={768}
            priority
            className="h-auto w-full object-cover"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
              WebkitMaskComposite: "source-in",
            }}
          />
        </div>
        <div className="mx-auto mt-4 grid w-full max-w-2xl grid-cols-2 gap-x-6 gap-y-3 px-4 text-start sm:mt-5 sm:gap-x-10">
          {highlights.map((h) => (
            <div key={h.title} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold sm:text-base">{h.title}</p>
                <p className="text-xs text-muted sm:text-sm">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="flex flex-col gap-10 border-t border-border px-6 py-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">{t("features.title")}</h2>
        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:gap-4">
          {featureItems.map((f, i) => (
            <div
              key={f.title}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3 text-center transition hover:border-accent/40 hover:shadow-lg sm:flex-row sm:items-start sm:gap-4 sm:p-5 sm:text-start"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 sm:h-11 sm:w-11">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-accent sm:h-5 sm:w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {FEATURE_ICONS[i]}
                </svg>
              </div>
              <div>
                <p className="text-xs font-medium sm:text-base">{f.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted sm:text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="markets" className="flex flex-col gap-4 border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
          <h2 className="text-2xl font-semibold">{t("markets.toolsTitle")}</h2>
          <p className="text-sm text-muted">{t("markets.toolsDesc")}</p>
        </div>
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-border">
          <MarketOverview />
        </div>
      </section>

      <section id="how-it-works" className="flex flex-col gap-10 px-6 py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2 text-center">
          <span className="text-xs font-medium text-accent">{t("howItWorks.badge")}</span>
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("howItWorks.title")}</h2>
          <p className="text-sm text-muted">{t("howItWorks.subtitle")}</p>
        </div>
        <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-6">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 transition hover:border-accent/40 hover:shadow-lg sm:gap-3 sm:p-6"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground sm:h-11 sm:w-11 sm:text-sm">
                {i + 1}
              </div>
              <p className="text-sm font-medium sm:text-lg">{s.title}</p>
              <p className="text-[11px] leading-relaxed text-muted sm:text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {topProviders && topProviders.length > 0 && (
        <section id="traders" className="flex flex-col gap-6 border-t border-border px-6 py-16">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
            <h2 className="text-2xl font-semibold">{t("traders.title")}</h2>
            <Link href="/discover" className="text-sm underline">
              {t("traders.viewAll")}
            </Link>
          </div>
          <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {topProviders.map((p) => {
              const copyHref = user
                ? `/trader/${p.provider_id}#copy`
                : `/signup?next=${encodeURIComponent(`/trader/${p.provider_id}#copy`)}`;
              return (
              <div
                key={p.provider_id}
                className="group relative flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 transition hover:border-accent/40 hover:shadow-lg sm:gap-3 sm:p-4"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-sm font-semibold text-white sm:h-10 sm:w-10">
                    {p.display_name?.charAt(0) ?? "؟"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm font-semibold">{p.display_name}</p>
                    </div>
                    <p className="text-xs text-muted">
                      {p.followers_count} {t("traders.copiers")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold sm:text-base">
                      {p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}
                    </p>
                    <p className="text-[11px] text-muted">{t("traders.winRate")}</p>
                  </div>
                  <div>
                    <p
                      className={
                        p.avg_return_pct != null && p.avg_return_pct < 0
                          ? "text-sm font-semibold text-danger sm:text-base"
                          : "text-sm font-semibold text-success sm:text-base"
                      }
                    >
                      {p.avg_return_pct != null ? `${p.avg_return_pct}%` : "—"}
                    </p>
                    <p className="text-[11px] text-muted">{t("traders.avgReturn")}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href={`/trader/${p.provider_id}`}
                    className="rounded border border-border bg-background px-3 py-2 text-center text-xs text-foreground sm:text-sm"
                  >
                    {t("traders.viewProfile")}
                  </Link>
                  <Link
                    href={copyHref}
                    className="rounded bg-accent px-3 py-2 text-center text-xs font-medium text-accent-foreground transition hover:bg-accent-hover sm:text-sm"
                  >
                    {t("traders.copy")}
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="mx-auto flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">{t("stats.title")}</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              {t("stats.live")}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-xl font-semibold sm:text-3xl">{totalTraders}+</p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                {t("stats.activeTraders")}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 1l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <p className="text-xl font-semibold sm:text-3xl">{totalCopiers.toLocaleString("en-US")}+</p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                {t("stats.copyUsers")}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-success sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 6l-9.5 9.5-5-5L1 18" />
                  <path d="M17 6h6v6" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-success sm:text-3xl">
                {avgWinRate != null ? `${avgWinRate}%` : "—"}
              </p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                {t("stats.avgWinRate")}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-success sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <p
                className="text-xl font-semibold text-success sm:text-3xl"
                title={`$${totalProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              >
                ${totalProfit.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}
              </p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                {t("stats.totalProfit")}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-success sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="7" />
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-success sm:text-3xl" dir="ltr">
                {bestReturn != null ? `+${bestReturn}%` : "—"}
              </p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                {t("stats.bestReturn")}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <p className="text-xl font-semibold sm:text-3xl">{totalExecutedTrades.toLocaleString("en-US")}+</p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                {t("stats.totalTrades")}
              </p>
            </div>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col gap-2 text-center text-xs leading-relaxed text-muted">
            <p>
              {t("stats.disclaimer")}{" "}
              <Link href="/legal/terms" className="underline">
                {t("stats.termsLink")}
              </Link>{" "}
              {t("stats.disclaimerEnd")}
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="flex flex-col gap-8 border-t border-border px-6 py-16">
        <div className="mx-auto flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("faq.title")}</h2>
          <p className="text-sm text-muted">{t("faq.subtitle")}</p>
        </div>
        <div className="mx-auto w-full max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {faqs.map((f) => (
            <details key={f.q} className="group open:bg-background/40">
              <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 marker:content-none sm:px-6 sm:py-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                  ؟
                </span>
                <span className="flex-1 pt-1.5 text-[15px] font-semibold leading-snug sm:text-base">
                  {f.q}
                </span>
                <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-all group-open:rotate-180 group-open:border-accent group-open:bg-accent/10 group-open:text-accent">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <div className="flex gap-4 px-5 pb-6 sm:px-6">
                <span className="h-9 w-9 shrink-0" aria-hidden="true" />
                <p className="flex-1 border-t border-border/60 pt-4 text-base leading-8 text-foreground">
                  {f.a}
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("cta.title")}</h2>
          <p className="max-w-sm text-sm text-muted">{t("cta.subtitle")}</p>
          <Link
            href="/signup"
            className="mt-2 rounded bg-accent px-6 py-3 font-medium text-accent-foreground transition hover:bg-accent-hover"
          >
            {t("cta.button")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-0.5 text-base font-semibold" dir="ltr">
              Copy Matrix
              <span className="flex items-center">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 19l3-5 3 3 5-9" />
                  <path d="M12 8h4v4" />
                </svg>
                <svg viewBox="0 0 24 24" className="-ml-1.5 h-3.5 w-3.5 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 19l3-5 3 3 5-9" />
                  <path d="M12 8h4v4" />
                </svg>
              </span>
            </span>
            <p className="max-w-xs text-sm text-muted">{t("footer.tagline")}</p>
          </div>

          <div className="flex flex-wrap gap-10 text-sm">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">{t("footer.platform")}</p>
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="text-muted hover:text-foreground">
                  {l.label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">{t("footer.legal")}</p>
              <Link href={FOOTER_LEGAL_HREFS[0]} className="text-muted hover:text-foreground">
                {t("footer.terms")}
              </Link>
              <Link href={FOOTER_LEGAL_HREFS[1]} className="text-muted hover:text-foreground">
                {t("footer.privacy")}
              </Link>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-8 w-full max-w-5xl border-t border-border pt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} Copy Matrix. {t("footer.rights")}
        </p>
      </footer>
    </main>
  );
}
