import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MarketOverview } from "@/components/MarketOverview";
import { LeaderCard } from "@/components/LeaderCard";
import { INTERNATIONAL_COUNTRY_CODES } from "@/lib/country-metadata";
import { TryCopySection } from "@/components/TryCopySection";
import { Header } from "@/components/Header";
import { ProductShowcase } from "@/components/showcase/ProductShowcase";
import { FeaturesGrid } from "@/components/FeaturesGrid";
import { HowItWorks } from "@/components/HowItWorks";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Footer } from "@/components/Footer";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { getBioTranslator } from "@/lib/bio-translations";
import { fetchBulkProviderStats } from "@/lib/provider-stats";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("Home");
  return { title: t("metaTitle") };
}

const TRUST_ICONS = {
  check: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
};

// Only claims that are true for every account: a free demo account exists
// (src/app/auth/actions.ts chooseAccountType) and every copy carries an
// automatic loss limit (subscriptions.max_drawdown_pct / auto_stop_copy).
const TRUST_ITEMS = [
  { icon: "check", colorClass: "text-accent", bgClass: "bg-accent/10", titleKey: "trustStrip.demoTitle", descKey: "trustStrip.demoDesc" },
  { icon: "shield", colorClass: "text-success", bgClass: "bg-success/10", titleKey: "trustStrip.stopLossTitle", descKey: "trustStrip.stopLossDesc" },
] as const;

// Bios that describe an aggressive style. A leader whose own bio says this
// must never be shown under a "low risk" badge on the landing page.
const HIGH_RISK_BIO = /عالي المخاطرة|مخاطر(?:ة)? (?:عالية|مرتفعة)|المخاطرة عندي أعلى|رافعة (?:مالية )?مرتفعة|عدوانية|جريء|مضاربة|شديدة التقلب|تقلبًا أكبر|high[- ]risk|high leverage|aggressive/i;

// Matches the balance every new demo account actually starts with
// (src/app/auth/actions.ts chooseAccountType).
const DEMO_START_BALANCE = 10000;

const NAV_HASHES = ["how-it-works", "traders", "markets", "faq"] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("Home");
  const locale = (await getLocale()) as Locale;
  const translateBio = await getBioTranslator();

  // The leader cards further down are meant to always be on the page, not
  // appear only when this happens to succeed on the first try -- so a
  // transient failure (a dropped connection, a cold start) gets two more
  // tries before giving up. provider_cards itself is fast and reliable now
  // (backed by provider_performance_mv, see migration 0144), so a retry
  // costs at most ~150ms extra and should essentially never be needed.
  // Matches the untyped shape .select("*") already returned here (no
  // generated Database types wired into this client).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawTopProviders: any[] | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Restricted to the curated international roster (see
    // country-metadata.ts) so the public homepage shows genuinely diverse,
    // non-Arabic-named leaders -- a plain highest-return sort over the
    // whole platform is dominated by the much larger Arabic-named pool.
    // Also low-risk, positive, and a healthy win rate only -- this section
    // is meant to read as "the leaders worth following", not just
    // whoever's return happens to be highest at this exact minute (which
    // could be a high-risk leader mid-swing, or one whose recent-trades
    // sparkline is choppy even with a decent long-run average). Archived
    // (long-dead/margined) leaders never appear here either.
    const { data, error } = await supabase
      .from("provider_cards")
      .select("*")
      .in("country", INTERNATIONAL_COUNTRY_CODES)
      .eq("risk_level", "منخفضة")
      .eq("is_archived", false)
      .gt("avg_daily_return_pct", 0)
      .gte("win_rate_pct", 65)
      .order("avg_daily_return_pct", { ascending: false, nullsFirst: false })
      .limit(10);
    if (!error) {
      // Keep the badge (risk_level, from trade data) and the bio consistent.
      rawTopProviders = (data ?? []).filter((p) => !(p.bio && HIGH_RISK_BIO.test(String(p.bio))));
      break;
    }
    console.error(`provider_cards fetch attempt ${attempt} failed:`, error.message);
  }

  const topProviders = rawTopProviders ? rawTopProviders.slice(0, 3) : rawTopProviders;

  // Cumulative return (%) over each featured leader's last closed trades, for
  // the sparkline on the card -- same per-trade move TraderEquityChart uses.
  const sparkSeries: Record<string, number[]> = {};
  const bulkStats = await fetchBulkProviderStats(supabase);
  await Promise.all(
    (topProviders ?? []).map(async (p) => {
      const { data: rows } = await supabase
        .from("signals")
        .select("side, entry_price, exit_price, closed_at")
        .eq("provider_id", p.provider_id)
        .eq("status", "closed")
        .eq("created_by_admin", false)
        .not("exit_price", "is", null)
        .order("closed_at", { ascending: false })
        .limit(40);
      let cumulative = 0;
      const series = [0];
      for (const r of (rows ?? []).reverse()) {
        const raw = (Number(r.exit_price) - Number(r.entry_price)) / Number(r.entry_price);
        cumulative += (r.side === "sell" ? -raw : raw) * 100;
        series.push(cumulative);
      }
      sparkSeries[String(p.provider_id)] = series;
    }),
  );

  // Real leaders for the "try copy trading" mockup card -- same ranking as
  // the top-traders section, just five bars instead of three cards.
  const tryCopyLeaders = (rawTopProviders ? rawTopProviders.slice(0, 5) : [])
    .filter((p) => p.avg_daily_return_pct != null && Number(p.avg_daily_return_pct) > 0)
    .map((p) => ({
      id: String(p.provider_id),
      name: String(p.display_name ?? "").trim().split(" ")[0] || "?",
      avatarUrl: (p.avatar_url as string | null) ?? null,
      ratingScore: (p.rating_score as number | null) ?? null,
      returnPct: Number(p.avg_daily_return_pct),
    }));

  const navLinks = NAV_HASHES.map((h) => ({ href: `#${h}`, label: t(`nav.${h === "how-it-works" ? "howItWorks" : h}`) }));
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <main className="flex min-h-screen flex-col">
      <Header locale={locale} dir={dir} navLinks={navLinks} loginLabel={t("nav.login")} signupLabel={t("nav.signup")} menuLabel={t("nav.menu")} />

      <section className="mx-auto w-full max-w-6xl px-6 pb-10 pt-5 md:py-20 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="flex flex-col items-center gap-3 text-center md:gap-5 lg:items-start lg:text-right">
          <h1 className="max-w-2xl font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            {t.rich("hero.title", {
              accent: (chunks) => <span className="text-white">{chunks}</span>,
            })}
          </h1>
          <p className="max-w-md text-muted">{t("hero.subtitle")}</p>
          <div className="flex w-full flex-col items-center gap-3 pt-2 md:w-auto md:flex-row md:flex-wrap md:justify-center lg:justify-start">
            <Link
              href="/signup"
              className="w-full rounded bg-accent px-6 py-3 text-center font-medium text-accent-foreground transition hover:bg-accent-hover md:w-auto"
            >
              {t("hero.start")}
            </Link>
            <a href="#traders" className="text-sm font-medium text-muted md:rounded md:border md:border-border md:px-6 md:py-3 md:text-base md:text-foreground">
              {t("hero.browse")} <span className="md:hidden">{dir === "rtl" ? "←" : "→"}</span>
            </a>
          </div>
          {/* Desktop: three marks with their full text. */}
          <div className="hidden flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs text-muted md:flex lg:justify-start">
            {[t("hero.trust0"), t("hero.trust1"), t("hero.trust2")].map((trustText) => (
              <span key={trustText} className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {trustText}
              </span>
            ))}
          </div>
          {/* Phones: the same marks, short, on one small line. */}
          <div className="flex items-center justify-center gap-x-2.5 whitespace-nowrap text-[10px] text-muted md:hidden">
            {[t("hero.trustShort0"), t("hero.trustShort1"), t("hero.trustShort2")].map((trustText) => (
              <span key={trustText} className="flex items-center gap-1">
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {trustText}
              </span>
            ))}
          </div>
        </div>

        <ProductShowcase />
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-start justify-center gap-x-10 gap-y-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.icon} className="flex flex-col items-center gap-1 text-center">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.bgClass}`}>
                <svg viewBox="0 0 24 24" className={`h-4 w-4 ${item.colorClass}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {TRUST_ICONS[item.icon]}
                </svg>
              </span>
              <p className="text-sm font-semibold">{t(item.titleKey)}</p>
              <p className="text-xs text-muted">{t(item.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <FeaturesGrid />

      {t.has("tryCopy.title") && tryCopyLeaders.length >= 3 && (
        <TryCopySection
          title={t("tryCopy.title")}
          description={t("tryCopy.description")}
          cta={t("tryCopy.cta")}
          ctaHref="/signup"
          badgeLabel={t("tryCopy.badge")}
          cardWelcome={t("tryCopy.cardWelcome")}
          cardPortfolioLabel={t("tryCopy.cardPortfolioLabel")}
          cardTopLabel={t("tryCopy.cardTopLabel")}
          liveLabel={t.has("tryCopy.live") ? t("tryCopy.live") : ""}
          portfolioValue={DEMO_START_BALANCE}
          leaders={tryCopyLeaders}
        />
      )}

      {topProviders && topProviders.length > 0 && (
        <section id="traders" className="flex flex-col gap-6 border-t border-border px-6 py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 text-center">
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{t("traders.title")}</h2>
            <p className="max-w-xl text-sm text-muted">{t("traders.subtitle")}</p>
          </div>
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
            {topProviders.map((p) => {
              const copyHref = user
                ? `/trader/${p.provider_id}#copy`
                : `/signup?next=${encodeURIComponent(`/trader/${p.provider_id}#copy`)}`;
              return (
                <LeaderCard
                  key={p.provider_id}
                  provider={p}
                  copyHref={copyHref}
                  bio={p.bio ? translateBio(p.bio) : null}
                  sparkline={sparkSeries[String(p.provider_id)]}
                  maxDrawdownPct={bulkStats.get(String(p.provider_id))?.maxDrawdown ?? null}
                />
              );
            })}
          </div>
          <Link
            href="/discover"
            className="mx-auto rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition hover:border-success/40 hover:text-success"
          >
            {t("traders.viewAll")}
          </Link>
        </section>
      )}

      <section id="markets" className="flex flex-col gap-4 border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
          <h2 className="font-display text-2xl font-extrabold">{t("markets.toolsTitle")}</h2>
          <p className="text-sm text-muted">{t("markets.toolsDesc")}</p>
        </div>
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-border">
          <MarketOverview />
        </div>
      </section>

      <HowItWorks />

      <FAQAccordion />

      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-14 text-center">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{t("cta.title")}</h2>
          <p className="max-w-sm text-sm text-muted">{t("cta.subtitle")}</p>
          <Link
            href="/signup"
            className="mt-2 rounded bg-accent px-6 py-3 font-medium text-accent-foreground transition hover:bg-accent-hover"
          >
            {t("cta.button")}
          </Link>
        </div>
      </section>

      <Footer dir={dir} navLinks={navLinks} />
    </main>
  );
}
