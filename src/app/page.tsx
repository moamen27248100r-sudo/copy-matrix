import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { MarketOverview } from "@/components/MarketOverview";
import { Header } from "@/components/Header";
import { HeroMockupB } from "@/components/mockup/HeroB";
import { FactCards, FeatureStrip, SECTION, Steps, TraderShowcase } from "@/components/landing/Sections";
import { StickyCta } from "@/components/landing/StickyCta";
import { FAQAccordion } from "@/components/FAQAccordion";
import { Footer } from "@/components/Footer";
import { isRtlLocale, type Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const t = await getTranslations("Home");
  return { title: t("metaTitle") };
}

const NAV_HASHES = ["how-it-works", "traders", "markets", "faq"] as const;

export default async function Home() {
  const t = await getTranslations("Home");
  const tShowcase = await getTranslations("HomeShowcase");
  const locale = (await getLocale()) as Locale;
  const navLinks = NAV_HASHES.map((h) => ({ href: `#${h}`, label: t(`nav.${h === "how-it-works" ? "howItWorks" : h}`) }));
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <main className="flex min-h-screen flex-col overflow-x-clip pb-20 md:pb-0">
      <Header locale={locale} dir={dir} navLinks={navLinks} loginLabel={t("nav.login")} signupLabel={t("nav.signup")} menuLabel={t("nav.menu")} />

      <section className="mx-auto w-full max-w-6xl px-5 pb-6 pt-8 md:px-6 md:pb-12 md:pt-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="flex flex-col items-stretch gap-5 text-start lg:items-start">
          <h1 className="ty-display max-w-xl">
            {t.rich("hero.title", { accent: (chunks) => <span className="text-[var(--text-accent)]">{chunks}</span> })}
          </h1>
          <p className="ty-body max-w-md">{t("hero.subtitle")}</p>
          <div className="flex flex-col gap-3 pt-1 lg:items-start">
            <Link
              id="hero-cta"
              href="/signup"
              className="w-full rounded-xl bg-accent px-6 py-3.5 text-center text-base font-bold text-accent-foreground transition hover:bg-accent-hover lg:w-auto lg:min-w-56"
            >
              {t("hero.start")}
            </Link>
            <Link href="/discover" className="py-1 text-base font-medium text-[var(--text-accent)]">
              {t("hero.browse")} <span aria-hidden="true">{dir === "rtl" ? "←" : "→"}</span>
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
      <TraderShowcase />

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
          <Link href="/signup" className="mt-2 rounded-xl bg-accent px-6 py-3.5 text-center text-base font-bold text-accent-foreground transition hover:bg-accent-hover md:min-w-56 md:self-start">
            {t("cta.button")}
          </Link>
        </div>
      </section>

      <Footer dir={dir} navLinks={navLinks} />
      <StickyCta href="/signup" label={t("hero.start")} heroId="hero-cta" endId="final-cta" />
    </main>
  );
}
