"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

const LOCALE_LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
  fr: "Français",
  es: "Español",
  pt: "Português",
  zh: "中文",
  hi: "हिन्दी",
  ur: "اردو",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
  th: "ไทย",
  bn: "বাংলা",
  sw: "Kiswahili",
};

const LOCALE_SHORT: Record<Locale, string> = {
  ar: "AR",
  en: "EN",
  fr: "FR",
  es: "ES",
  pt: "PT",
  zh: "ZH",
  hi: "HI",
  ur: "UR",
  id: "ID",
  vi: "VI",
  th: "TH",
  bn: "BN",
  sw: "SW",
};

const PANEL_WIDTH = 176;
const VIEWPORT_MARGIN = 8;

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function place() {
      const rect = buttonRef.current!.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      // Prefer aligning the panel's end edge with the button's end edge,
      // but clamp so it never runs off either side of the viewport.
      let left = rect.right - PANEL_WIDTH;
      left = Math.min(left, viewportWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
      left = Math.max(left, VIEWPORT_MARGIN);
      setPanelPos({ top: rect.bottom + 4, left });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 whitespace-nowrap rounded border border-border px-1.5 py-1.5 text-[11px] text-foreground sm:gap-1.5 sm:px-2.5 sm:text-sm"
        aria-label="Language"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {LOCALE_SHORT[currentLocale]}
      </button>
      {open && panelPos && (
        <div
          className="fixed z-30 max-h-64 overflow-y-auto rounded border border-border bg-surface shadow-lg"
          style={{ top: panelPos.top, left: panelPos.left, width: PANEL_WIDTH }}
        >
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
