import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/locales";

type NavLink = { href: string; label: string };

const TEXT = {
  ar: {
    tagline: "منصة نسخ التداول الذكية عبر 4 أسواق عالمية.",
    platform: "المنصة",
    wallet: "بوابة السحب والإيداع",
    security: "الأمان والشفافية",
    securityCenter: "مركز الأمان",
    riskDisclosure: "تحذير المخاطر",
    support: "الدعم والشروط",
    supportLink: "الدعم الفني",
    terms: "الشروط والأحكام",
    privacy: "سياسة الخصوصية",
    rights: "جميع الحقوق محفوظة.",
  },
  en: {
    tagline: "A smart copy trading platform across 4 global markets.",
    platform: "Platform",
    wallet: "Deposit & withdraw gateway",
    security: "Security & transparency",
    securityCenter: "Security center",
    riskDisclosure: "Risk disclosure",
    support: "Support & terms",
    supportLink: "Support",
    terms: "Terms & conditions",
    privacy: "Privacy policy",
    rights: "All rights reserved.",
  },
} as const;

export function Footer({ locale, dir, navLinks }: { locale: Locale; dir: "rtl" | "ltr"; navLinks: NavLink[] }) {
  const isAr = locale === "ar";
  const t = isAr ? TEXT.ar : TEXT.en;

  return (
    <footer dir={dir} className="border-t border-cyan-500/10 px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Logo iconClassName="h-5 w-5" textClassName="text-lg" />
          <p className="line-clamp-2 max-w-xs text-sm text-muted">{t.tagline}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-cyan-500/15 bg-slate-900/40 p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-cyan-300">{t.platform}</p>
            <div className="flex flex-col gap-2 text-sm">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} className="line-clamp-1 text-muted hover:text-foreground">
                  {l.label}
                </a>
              ))}
              <Link href="/portfolio/deposit" className="line-clamp-1 text-muted hover:text-foreground">
                {t.wallet}
              </Link>
            </div>
          </div>

          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-cyan-500/15 bg-slate-900/40 p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-cyan-300">{t.security}</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/security" className="line-clamp-1 text-muted hover:text-foreground">
                {t.securityCenter}
              </Link>
              <Link href="/risk-disclosure" className="line-clamp-1 text-muted hover:text-foreground">
                {t.riskDisclosure}
              </Link>
            </div>
          </div>

          <div className="flex h-full flex-col justify-between gap-2 rounded-2xl border border-cyan-500/15 bg-slate-900/40 p-5 backdrop-blur-xl">
            <p className="line-clamp-1 text-xs font-semibold text-cyan-300">{t.support}</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/support" className="line-clamp-1 text-muted hover:text-foreground">
                {t.supportLink}
              </Link>
              <Link href="/legal/terms" className="line-clamp-1 text-muted hover:text-foreground">
                {t.terms}
              </Link>
              <Link href="/legal/privacy" className="line-clamp-1 text-muted hover:text-foreground">
                {t.privacy}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-8 w-full max-w-5xl border-t border-cyan-500/10 pt-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Copy Matrix. {t.rights}
      </p>
    </footer>
  );
}
