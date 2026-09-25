import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/locales";

type NavLink = { href: string; label: string };

export function Header({
  locale,
  dir,
  navLinks,
  loginLabel,
  signupLabel,
}: {
  locale: Locale;
  dir: "rtl" | "ltr";
  navLinks: NavLink[];
  loginLabel: string;
  signupLabel: string;
}) {
  return (
    <nav dir={dir} className="sticky top-0 z-[9999] border-b border-glass-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-2 py-3 sm:px-6 sm:py-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-0.5 sm:gap-3">
          <Button href="/signup" variant="primary" size="sm" className="min-w-0 px-1 sm:px-4">
            {signupLabel}
          </Button>

          <span className="flex min-w-0 items-center justify-center overflow-hidden">
            <Logo iconClassName="h-4 w-4 sm:h-5 sm:w-5" textClassName="text-base sm:text-xl" />
          </span>

          <div className="flex min-w-0 items-center gap-0.5 sm:gap-3">
            <LanguageSwitcher currentLocale={locale} />
            <Button href="/login" variant="outline" size="sm" className="min-w-0 px-0.5 sm:px-4">
              {loginLabel}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted sm:gap-x-6 sm:pt-3 sm:text-sm">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="line-clamp-1 hover:text-neon-cyan">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
