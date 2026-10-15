import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { HeroMockupB } from "@/components/mockup/HeroB";
import { isRtlLocale, type Locale } from "@/i18n/locales";

// PREVIEW of hero option B -- not the home page, not linked from anywhere, not indexable. The home
// page keeps its current hero until one option is chosen.
export const metadata: Metadata = {
  title: "Hero preview B",
  robots: { index: false, follow: false, nocache: true },
};

export default async function HeroPreviewB() {
  const t = await getTranslations("Home");
  const locale = (await getLocale()) as Locale;
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const navLinks = [
    { href: "#how-it-works", label: t("nav.howItWorks") },
    { href: "#traders", label: t("nav.traders") },
    { href: "#markets", label: t("nav.markets") },
    { href: "#faq", label: t("nav.faq") },
  ];

  return (
    <main className="flex min-h-screen flex-col overflow-x-clip">
      <Header locale={locale} dir={dir} navLinks={navLinks} loginLabel={t("nav.login")} signupLabel={t("nav.signup")} menuLabel={t("nav.menu")} />

      <section className="mx-auto w-full max-w-6xl px-6 pb-4 pt-5 md:py-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="flex flex-col items-center gap-3 text-center md:gap-5 lg:items-start lg:text-start">
          <h1 className="max-w-2xl font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl">
            {t.rich("hero.title", { accent: (chunks) => <span className="text-white">{chunks}</span> })}
          </h1>
          <p className="max-w-md text-muted">{t("hero.subtitle")}</p>
          <div className="flex w-full flex-col items-center gap-3 pt-2 md:w-auto md:flex-row md:flex-wrap md:justify-center lg:justify-start">
            <Link href="/signup" className="w-full rounded bg-accent px-6 py-3 text-center font-medium text-accent-foreground transition hover:bg-accent-hover md:w-auto">
              {t("hero.start")}
            </Link>
            <Link href="/discover" className="text-sm font-medium text-muted md:rounded md:border md:border-border md:px-6 md:py-3 md:text-base md:text-foreground">
              {t("hero.browse")}
            </Link>
          </div>
        </div>
        <HeroMockupB />
      </section>

      <p className="mx-auto max-w-sm px-6 pb-10 text-center text-[11px] text-muted">{(await getTranslations("HomeShowcase"))("disclaimer")}</p>
    </main>
  );
}
