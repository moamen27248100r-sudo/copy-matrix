import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { HeaderMobileMenu } from "@/components/HeaderMobileMenu";
import type { Locale } from "@/i18n/locales";

type NavLink = { href: string; label: string };

export function Header({
  locale,
  dir,
  navLinks,
  loginLabel,
  signupLabel,
  menuLabel,
}: {
  locale: Locale;
  dir: "rtl" | "ltr";
  navLinks: NavLink[];
  loginLabel: string;
  signupLabel: string;
  menuLabel: string;
}) {
  return (
    <nav dir={dir} className="sticky top-0 z-[9999] border-b border-glass-border bg-background/95 backdrop-blur-xl">
      {/* Phones: logo + small sign-up button + hamburger; everything else is in the menu. */}
      <div className="relative mx-auto max-w-6xl px-4 py-2.5 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <Logo iconClassName="h-4 w-4" textClassName="text-base" />
          <div className="flex items-center gap-2">
            <Button href="/signup" variant="primary" size="sm" className="h-9 px-3 text-xs">
              {signupLabel}
            </Button>
            <HeaderMobileMenu locale={locale} navLinks={navLinks} loginLabel={loginLabel} menuLabel={menuLabel} />
          </div>
        </div>
      </div>

      <div className="mx-auto hidden max-w-6xl px-2 py-3 sm:px-6 sm:py-4 md:block">
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
            <a key={l.href} href={l.href} className="line-clamp-1 hover:text-foreground">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
