import Link from "next/link";
import { getSparklines } from "@/lib/sparklines";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MarketOverview } from "@/components/MarketOverview";
import { LeaderCard } from "@/components/LeaderCard";
import { Header } from "@/components/Header";
import { ArrowRight, ChartCandlestick, Copy, ShieldCheck } from "lucide-react";
import { HeroVideo } from "@/components/landing/HeroVideo";
import { FactCards, FeatureStrip, SECTION, Steps } from "@/components/landing/Sections";
import { CardsCarousel } from "@/components/landing/CardsCarousel";
import { StickyCta } from "@/components/landing/StickyCta";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Footer } from "@/components/Footer";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { getBioTranslator } from "@/lib/bio-translations";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("Home");
  return { title: t("metaTitle") };
}

const NAV_HASHES = ["how-it-works", "traders", "markets", "faq"] as const;

const HERO_POINTS = [
  { key: "feature1", Icon: Copy },
  { key: "feature2", Icon: ShieldCheck },
  { key: "feature3", Icon: ChartCandlestick },
] as const;

// Each market goes to its best-known instrument's page; copying to the guide on how it works.
const HERO_STRIP = [
  { key: "traders", href: "/discover" },
  { key: "crypto", href: "/markets/BTCUSDT" },
  { key: "gold", href: "/markets/XAUUSD" },
  { key: "forex", href: "/markets/EURUSD" },
  { key: "copy", href: "/learn/how_copy_works" },
  { key: "portfolio", href: "/portfolio" },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations("Home");
  const tl = await getTranslations("Home.landing");
  const tShowcase = await getTranslations("HomeShowcase");
  const th = await getTranslations("Home.heroV2");
  const locale = (await getLocale()) as Locale;
  const translateBio = await getBioTranslator();

  // The six leaders with the highest 30-day return among low- and medium-risk ones with enough
  // closed trades in the period (a return over a handful of trades says nothing); archived and
  // stopped ones excluded.
  // Same two retries as before: the cards should be on the page, not there only when the first try
  // happens to succeed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let topProviders: any[] | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await supabase
      .from("provider_cards")
      .select("*")
      .eq("is_archived", false)
      .neq("trading_status", "stopped")
      .in("risk_level", ["منخفضة", "متوسطة"])
      .gt("roi_30d", 0)
      .gte("trades_30d", 20)
      .order("roi_30d", { ascending: false })
      .limit(6);
    if (!error) {
      topProviders = data ?? [];
      break;
    }
    console.error(`provider_cards fetch attempt ${attempt} failed:`, error.message);
  }

  // Return (%) over each featured leader's last 30 days, for the curve on the card.
  const sparkSeries = await getSparklines(supabase, (topProviders ?? []).map((p) => String(p.provider_id)));

  const navLinks = NAV_HASHES.map((h) => ({ href: `#${h}`, label: t(`nav.${h === "how-it-works" ? "howItWorks" : h}`) }));
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <main className="flex min-h-screen flex-col overflow-x-clip pb-20 md:pb-0">
      <Header locale={locale} dir={dir} navLinks={navLinks} loginLabel={t("nav.login")} signupLabel={t("nav.signup")} menuLabel={t("nav.menu")} />

      {/* Hero: headline, three short points, the button, the film, then a strip of places to go. */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-8 md:px-6 md:pb-12 md:pt-14">
        <h1 className={`${dir === "rtl" ? "max-w-[6em] md:max-w-4xl" : "max-w-4xl"} text-[2.75rem] font-bold leading-[1.08] tracking-tight text-foreground md:text-6xl md:leading-[1.05] lg:text-7xl`}>
          {t.rich("hero.title", { accent: (chunks) => chunks })}
        </h1>
        <div className="mt-6 flex flex-col gap-6 md:mt-8 md:flex-row md:items-center md:justify-between">
          <ul className="flex flex-col gap-3 md:flex-row md:gap-8">
            {HERO_POINTS.map(({ key, Icon }) => (
              <li key={key} className="flex items-center gap-2.5 text-base text-[var(--text-secondary)]">
                <Icon className="h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
                {th(key)}
              </li>
            ))}
          </ul>
          <Link
            id="hero-cta"
            href="/signup"
            className="inline-flex w-fit shrink-0 items-center gap-3 rounded-full bg-accent px-8 py-4 text-lg font-bold text-accent-foreground transition hover:bg-accent-hover"
          >
            {t("hero.start")}
            <ArrowRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-8 md:mt-10">
          {/* The poster is the largest thing on a phone: fetched first, the right size for the screen. */}
          <link rel="preload" as="image" href={`/video/hero-${locale === "ar" ? "ar" : "en"}-mobile.jpg`} media="(max-width: 767px)" fetchPriority="high" />
          <link rel="preload" as="image" href={`/video/hero-${locale === "ar" ? "ar" : "en"}-desktop.jpg`} media="(min-width: 768px)" fetchPriority="high" />
          <HeroVideo lang={locale === "ar" ? "ar" : "en"} />
          <p className="ty-small mt-2 px-3 text-center">{tShowcase("disclaimer")}</p>
        </div>

        <nav aria-label={th("stripLabel")} className="no-scrollbar -mx-4 mt-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex w-max gap-6 py-2 md:gap-8">
            {HERO_STRIP.map(({ key, href }) => (
              <li key={key}>
                <Link
                  href={href}
                  className="whitespace-nowrap text-base font-medium text-foreground underline decoration-white/40 underline-offset-[6px] transition hover:text-accent-text hover:decoration-accent-text"
                >
                  {th(`strip.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <FeatureStrip />
      <Steps />
      <FactCards />

      {topProviders && topProviders.length > 0 && (
        <section id="traders" className={SECTION}>
          <h2 className="ty-section">{t("traders.title")}</h2>
          <p className="ty-body mt-3 max-w-xl">{tl("traderSubtitle")}</p>
          <div className="mt-8">
            <CardsCarousel prevLabel={tl("prev")} nextLabel={tl("next")}>
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
                    maxDrawdownPct={p.mdd_30d != null ? Number(p.mdd_30d) : null}
                  />
                );
              })}
            </CardsCarousel>
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              href="/discover"
              className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition hover:border-success/40 hover:text-success"
            >
              {t("traders.viewAll")}
            </Link>
          </div>
        </section>
      )}

      <section id="markets" className={SECTION}>
        <h2 className="ty-section">{t("markets.toolsTitle")}</h2>
        <p className="ty-body mt-3 max-w-xl">{t("markets.toolsDesc")}</p>
        <div className="mt-8 overflow-hidden rounded-[20px] border border-white/10">
          <MarketOverview />
        </div>
      </section>

      <FAQAccordion />

      <section id="final-cta" className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-6 md:pb-20">
        <div className="flex flex-col items-stretch gap-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-7 text-start md:items-start md:p-10">
          <h2 className="ty-section">{t("cta.title")}</h2>
          <p className="ty-body max-w-md">{t("cta.subtitle")}</p>
          <Link href="/signup" className="mt-2 rounded bg-accent px-6 py-3 text-center font-medium text-accent-foreground transition hover:bg-accent-hover md:self-start">
            {t("cta.button")}
          </Link>
        </div>
      </section>

      <Footer dir={dir} navLinks={navLinks} />
      <StickyCta href="/signup" label={t("hero.start")} heroId="hero-cta" endId="final-cta" />
    </main>
  );
}
