"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

const LOCALE_LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

const LOCALE_SHORT: Record<Locale, string> = {
  ar: "AR",
  en: "EN",
};

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-foreground sm:text-sm"
        aria-label="Language"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {LOCALE_SHORT[currentLocale]}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-1 w-32 overflow-hidden rounded border border-border bg-surface shadow-lg">
          {SUPPORTED_LOCALES.map((locale) => (
            <form key={locale} action={setLocale}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="path" value={pathname} />
              <button
                type="submit"
                onClick={() => setOpen(false)}
                className={
                  locale === currentLocale
                    ? "block w-full px-3 py-2 text-start text-sm bg-accent/10 text-accent"
                    : "block w-full px-3 py-2 text-start text-sm text-foreground hover:bg-background"
                }
              >
                {LOCALE_LABELS[locale]}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
