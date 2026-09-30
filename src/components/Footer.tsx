import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AccountSecurity } from "@/components/AccountSecurity";
import { useTranslations } from "next-intl";
import { PLATFORM_NAME, SUPPORT_EMAIL } from "@/config/platform";

type NavLink = { href: string; label: string };

export function Footer({ dir, navLinks }: { dir: "rtl" | "ltr"; navLinks: NavLink[] }) {
  const t = useTranslations("SiteFooter");

  return (
    <footer dir={dir} className="border-t border-glass-border px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Logo iconClassName="h-5 w-5" textClassName="text-lg" />
          <p className="line-clamp-2 max-w-xs text-sm text-muted">{t("tagline")}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-slate-400">{t("platform")}</p>
            <div className="flex flex-col gap-2 text-sm">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="line-clamp-1 text-muted hover:text-foreground">
                  {l.label}
                </a>
              ))}
              <Link href="/about" className="line-clamp-1 text-muted hover:text-foreground">
                {t("about")}
              </Link>
            </div>
          </div>

          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-slate-400">{t("security")}</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/security" className="line-clamp-1 text-muted hover:text-foreground">
                {t("securityCenter")}
              </Link>
              <Link href="/risk-disclosure" className="line-clamp-1 text-muted hover:text-foreground">
                {t("riskDisclosure")}
              </Link>
            </div>
          </div>

          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-slate-400">{t("support")}</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/support" className="line-clamp-1 text-muted hover:text-foreground">
                {t("supportLink")}
              </Link>
              <Link href="/legal/terms" className="line-clamp-1 text-muted hover:text-foreground">
                {t("terms")}
              </Link>
              <Link href="/legal/privacy" className="line-clamp-1 text-muted hover:text-foreground">
                {t("privacy")}
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="line-clamp-1 text-start text-muted hover:text-foreground">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <AccountSecurity />
      </div>

      <div className="mx-auto mt-8 w-full max-w-5xl border-t border-glass-border pt-6 text-center">
        <p className="mx-auto max-w-2xl text-[11px] leading-relaxed text-muted/80">{t("riskDisclaimer")}</p>
        <p className="mt-3 text-xs text-muted">
          © {new Date().getFullYear()} {PLATFORM_NAME}. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
