import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SUPPORT_EMAIL } from "@/config/platform";
import type { Locale } from "@/i18n/locales";

// Landing footer: four plain link columns (no boxes), the full risk warning,
// language selection, contact e-mail and copyright.
export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations("Landing");

  const columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
    {
      title: t("footPlatform"),
      links: [
        { label: t("navTraders"), href: "/#traders" },
        { label: t("navMarkets"), href: "/#markets" },
        { label: t("navHow"), href: "/#how-it-works" },
        { label: t("navFees"), href: "/#fees" },
      ],
    },
    {
      // TODO(owner): there is no About page yet; add it here when it exists.
      title: t("footCompany"),
      links: [
        { label: t("footSecurity"), href: "/security" },
        { label: t("footContact"), href: `mailto:${SUPPORT_EMAIL}`, external: true },
      ],
    },
    {
      title: t("footSupport"),
      links: [
        { label: t("footSupportCenter"), href: "/support" },
        { label: t("navFaq"), href: "/#faq" },
      ],
    },
    {
      title: t("footLegal"),
      links: [
        { label: t("footTerms"), href: "/legal/terms" },
        { label: t("footPrivacy"), href: "/legal/privacy" },
        { label: t("footRisk"), href: "/risk-disclosure" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo iconClassName="h-4 w-4" textClassName="text-lg" />
            <a href={`mailto:${SUPPORT_EMAIL}`} className="num text-sm text-muted hover:text-foreground">
              {SUPPORT_EMAIL}
            </a>
            <LanguageSwitcher currentLocale={locale} />
          </div>
          {columns.map((c) => (
            <nav key={c.title} aria-label={c.title} className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{c.title}</p>
              <ul className="flex flex-col gap-2.5 text-sm text-muted">
                {c.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} className="hover:text-foreground">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="hover:text-foreground">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="mt-12 max-w-4xl border-t border-border pt-8 text-xs leading-6 text-muted">{t("riskWarning")}</p>
        <p className="mt-4 text-xs text-muted">
          © <span className="num">2026</span> Copy Matrix. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
