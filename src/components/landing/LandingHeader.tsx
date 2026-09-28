"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { Locale } from "@/i18n/locales";

type NavLink = { href: string; label: string };

// Fixed header: translucent background with a light blur and a hairline
// bottom border once the page has scrolled. Mobile keeps only the logo, a
// text login link, a small sign-up button and the menu (links + language).
export function LandingHeader({
  locale,
  navLinks,
  loginLabel,
  signupLabel,
  menuLabel,
  closeLabel,
  languageLabel,
}: {
  locale: Locale;
  navLinks: NavLink[];
  loginLabel: string;
  signupLabel: string;
  menuLabel: string;
  closeLabel: string;
  languageLabel: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 bg-background/80 backdrop-blur-md transition-colors ${
        scrolled || open ? "border-b border-border" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Copy Matrix" className="shrink-0">
          <Logo iconClassName="h-4 w-4" textClassName="text-lg" />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex" aria-label={menuLabel}>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/login" className="text-sm text-muted transition-colors hover:text-foreground">
            {loginLabel}
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            {signupLabel}
          </Link>
          <button
            type="button"
            className="-me-1 flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-foreground md:hidden"
            aria-label={open ? closeLabel : menuLabel}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-4 py-3">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base text-foreground hover:bg-surface"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border px-3 pt-4">
              <span className="text-sm text-muted">{languageLabel}</span>
              <LanguageSwitcher currentLocale={locale} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
