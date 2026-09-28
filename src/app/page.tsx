import { existsSync } from "node:fs";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getTranslations, getLocale } from "next-intl/server";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { TradersTabs, type TraderCardData } from "@/components/landing/TradersTabs";
import { LandingTicker } from "@/components/landing/LandingTicker";
import { PhoneFrame } from "@/components/landing/frames";
import { Reveal } from "@/components/landing/Reveal";
import {
  Hero,
  ShowcaseRow,
  FollowTrades,
  FactsStrip,
  SectionHeading,
  HowItWorks,
  Protection,
  Transparency,
  Fees,
  DemoSection,
  Markets,
  Faq,
  FinalCta,
} from "@/components/landing/sections";
import { Footer } from "@/components/Footer";
import { getLandingTraders, getMinCopyAmount, type LandingTrader } from "@/lib/landing-data";
import type { Locale } from "@/i18n/locales";

function marketKey(symbol: string | null): "marketCrypto" | "marketForex" | "marketGold" | "marketIndex" {
  if (!symbol) return "marketForex";
  if (symbol.endsWith("USDT")) return "marketCrypto";
  if (symbol === "XAUUSD") return "marketGold";
  if (symbol === "US30") return "marketIndex";
  return "marketForex";
}

// Prices for the ticker's first paint (it polls market_prices itself afterwards).
const getTickerPrices = unstable_cache(
  async () => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await supabase
      .from("market_prices")
      .select("symbol, price")
      .in("symbol", ["BTCUSDT", "ETHUSDT", "XAUUSD", "EURUSD", "SOLUSDT", "BNBUSDT", "XRPUSDT"]);
    return Object.fromEntries((data ?? []).map((r) => [r.symbol as string, Number(r.price)]));
  },
  ["landing-ticker-prices"],
  { revalidate: 30 },
);

export default async function Home() {
  const t = await getTranslations("Landing");
  const tc = await getTranslations("Countries");
  const locale = (await getLocale()) as Locale;

  const [traders, minCopy, tickerPrices] = await Promise.all([
    getLandingTraders(locale === "ar"),
    getMinCopyAmount(),
    getTickerPrices().catch(() => ({}) as Record<string, number>),
  ]);
  // Optional product video: shown inside the phone frame when the file exists.
  const videoSrc = existsSync(path.join(process.cwd(), "public", "videos", "hero.mp4")) ? "/videos/hero.mp4" : null;

  const decorate = (x: LandingTrader): TraderCardData => ({
    ...x,
    countryLabel: x.country && tc.has(x.country) ? tc(x.country) : "",
    marketLabel: t(marketKey(x.symbol)),
    profileHref: `/trader/${x.id}`,
    // The trader page itself sends visitors who are not signed in to sign-up.
    copyHref: `/trader/${x.id}#copy`,
  });

  // Tabs with fewer than 3 traders are hidden; with none left, the whole
  // section goes away (and so does the hero mockup, which uses the first one).
  const tabs = [
    { key: "followers", label: t("tabFollowers"), items: traders.followers.map(decorate) },
    { key: "risk", label: t("tabRisk"), items: traders.risk.map(decorate) },
    { key: "return", label: t("tabReturn"), items: traders.return.map(decorate) },
  ].filter((tab) => tab.items.length >= 3);

  const navLinks = [
    { href: "#traders", label: t("navTraders") },
    { href: "#markets", label: t("navMarkets") },
    { href: "#how-it-works", label: t("navHow") },
    { href: "#fees", label: t("navFees") },
    { href: "#faq", label: t("navFaq") },
  ];

  return (
    <div className="landing min-h-screen">
      <LandingHeader
        locale={locale}
        navLinks={navLinks}
        loginLabel={t("login")}
        signupLabel={t("signup")}
        menuLabel={t("menu")}
        closeLabel={t("closeMenu")}
        languageLabel={t("language")}
      />
      <main className="pt-16">
        <LandingTicker initialPrices={tickerPrices} label={t("tickerLabel")} />
        <Hero videoSrc={videoSrc} />
        <FactsStrip minCopy={minCopy} />

        {tabs.length > 0 && (
          <section className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 landing-section">
            <Reveal className="flex flex-col gap-8">
              <SectionHeading id="traders" title={t("tradersTitle")} action={{ href: "/discover", label: t("tradersViewAll") }} />
              <TradersTabs
                tabs={tabs}
                labels={{
                  return12: t("return12"),
                  maxDd: t("maxDd"),
                  risk: t("riskLabel"),
                  copiers: t("copiers"),
                  copy: t("copy"),
                  pastPerf: t("pastPerf"),
                }}
              />
            </Reveal>
          </section>
        )}

        {tabs.length > 0 && (
          <ShowcaseRow title={t("showTradersTitle")} desc={t("showTradersDesc")} flip>
            <PhoneFrame src="/images/product/mobile-trader.webp" alt={t("altTraderMobile")} width={280} sizes="280px" />
          </ShowcaseRow>
        )}
        <HowItWorks />
        <Protection />
        <FollowTrades />
        <Transparency />
        <Fees />
        <DemoSection />
        <Markets />
        <Faq minCopy={minCopy} />
        <FinalCta />
      </main>
      <Footer locale={locale} />
    </div>
  );
}
