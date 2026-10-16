import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { HeaderMobileMenu } from "@/components/HeaderMobileMenu";
import type { Locale } from "@/i18n/locales";

type NavLink = { href: string; label: string };

// A plain bar: the logo, "log in" as text, sign-up as an outlined button, and the menu (phones) or
// the section links and the language switcher (wider screens).
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
  const login = "tap-44 inline-flex items-center whitespace-nowrap text-sm font-medium text-foreground transition hover:text-accent-text";
  const signup =
    "tap-44 inline-flex h-9 items-center whitespace-nowrap rounded-full border border-white/25 px-4 text-sm font-medium text-foreground transition hover:border-white/50 hover:bg-white/5";
  return (
    <nav dir={dir} className="sticky top-0 z-[9999] border-b border-glass-border bg-background/95 backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-6 md:py-3.5">
        <Logo iconClassName="h-4 w-4 md:h-5 md:w-5" textClassName="text-base md:text-xl" />

        <div className="hidden flex-1 items-center justify-center gap-6 text-sm text-muted md:flex">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="whitespace-nowrap hover:text-foreground">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <span className="hidden md:inline-flex">
            <LanguageSwitcher currentLocale={locale} />
          </span>
          <Link href="/login" className={login}>
            {loginLabel}
          </Link>
          <Link href="/signup" className={signup}>
            {signupLabel}
          </Link>
          <span className="md:hidden">
            <HeaderMobileMenu locale={locale} navLinks={navLinks} loginLabel={loginLabel} menuLabel={menuLabel} />
          </span>
        </div>
      </div>
    </nav>
  );
}
