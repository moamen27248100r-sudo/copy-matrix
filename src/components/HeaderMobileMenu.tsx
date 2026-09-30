"use client";

import { useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { Locale } from "@/i18n/locales";

type NavLink = { href: string; label: string };

// Phone-only header menu: the section links, login and language switcher
// live here so the bar itself stays logo + sign-up + hamburger.
export function HeaderMobileMenu({
  locale,
  navLinks,
  loginLabel,
  menuLabel,
}: {
  locale: Locale;
  navLinks: NavLink[];
  loginLabel: string;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={menuLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-foreground touch-manipulation"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-b border-glass-border bg-background px-4 py-3 shadow-xl">
          <div className="flex flex-col text-sm">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 text-foreground"
              >
                {l.label}
              </a>
            ))}
            <a href="/login" className="border-b border-border/60 py-3 text-foreground">
              {loginLabel}
            </a>
            <div className="flex items-center py-3">
              <LanguageSwitcher currentLocale={locale} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
