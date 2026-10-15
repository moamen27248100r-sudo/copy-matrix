import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MarketOverview } from "@/components/MarketOverview";
import { LeaderCard } from "@/components/LeaderCard";
import { Header } from "@/components/Header";
import { HeroMockupB } from "@/components/mockup/HeroB";
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

// Preview only: the colour of the highlighted words in the headline, chosen with ?accent=a|b.
//   a  one solid blue from the platform's blue family (#7FA2F5)
//   b  a soft gradient from #A8C0FF to #3D6FD9
const ACCENT_CLASS = {
  a: "text-[#7FA2F5]",
  b: "bg-gradient-to-r from-[#A8C0FF] to-[#3D6FD9] bg-clip-text text-transparent rtl:bg-gradient-to-l",
} as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ accent?: string }> }) {
  const { accent } = await searchParams;
  const accentClass = accent === "b" ? ACCENT_CLASS.b : ACCENT_CLASS.a;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const t = await getTranslations("Home");
  const tl = await getTranslations("Home.landing");
  const tShowcase = await getTranslations("HomeShowcase");
  const locale = (await getLocale()) as Locale;
  const translateBio = await getBioTranslator();

  // The six leaders with the highest 30-day return among those with enough closed trades in the
  // period (a return over a handful of trades says nothing), archived and stopped ones excluded.
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

  // Return (%) over each featured leader's last 30 days, for the sparkline on the card.
  const sparkSeries: Record<string, number[]> = {};
  await Promise.all(
    (topProviders ?? []).map(async (p) => {
      const { data } = await supabase.rpc("provider_daily_series", { p_provider_id: p.provider_id });
      const ret = ((data as { ret?: number[] } | null)?.ret ?? []).slice(-30);
      let index = 1;
      const series = [0];
      for (const r of ret) {
        index *= 1 + Number(r);
        series.push((index - 1) * 100);
      }
      sparkSeries[String(p.provider_id)] = series;
    }),
  );

  const navLinks = NAV_HASHES.map((h) => ({ href: `#${h}`, label: t(`nav.${h === "how-it-works" ? "howItWorks" : h}`) }));
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <main className="flex min-h-screen flex-col overflow-x-clip pb-20 md:pb-0">
      <Header locale={locale} dir={dir} navLinks={navLinks} loginLabel={t("nav.login")} signupLabel={t("nav.signup")} menuLabel={t("nav.menu")} />

      <section className="mx-auto w-full max-w-6xl px-5 pb-6 pt-8 md:px-6 md:pb-12 md:pt-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="flex flex-col items-stretch gap-5 text-start lg:items-start">
          <h1 className="ty-display max-w-xl">
            {t.rich("hero.title", { accent: (chunks) => <span className={accentClass}>{chunks}</span> })}
          </h1>
          <p className="ty-body max-w-md">{t("hero.subtitle")}</p>
          <div className="flex w-full flex-col items-center gap-3 pt-1 md:w-auto md:flex-row md:flex-wrap">
            <Link
              id="hero-cta"
              href="/signup"
              className="w-full rounded bg-accent px-6 py-3 text-center font-medium text-accent-foreground transition hover:bg-accent-hover md:w-auto"
            >
              {t("hero.start")}
            </Link>
            <Link href="/discover" className="text-sm font-medium text-muted md:rounded md:border md:border-border md:px-6 md:py-3 md:text-base md:text-foreground">
              {t("hero.browse")} <span className="md:hidden">{dir === "rtl" ? "←" : "→"}</span>
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-col lg:mt-0">
          <HeroMockupB />
          <p className="ty-small mx-auto mt-2 max-w-sm px-3 text-center">{tShowcase("disclaimer")}</p>
        </div>
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
