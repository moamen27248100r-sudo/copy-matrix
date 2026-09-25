"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

type SortOption = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

const PANEL_WIDTH = 220;
const VIEWPORT_MARGIN = 8;

// A pill button that opens a small dropdown of sort options -- same
// positioning approach as LanguageSwitcher (fixed panel, clamped to the
// viewport, closes on outside click), reused here for a consistent feel.
// Each option is a plain <Link> (navigates via the existing ?sort= query
// param, no client state) so sorting stays driven by the server component.
export function SortDropdown({
  options,
  currentLabel,
  compact = false,
}: {
  options: SortOption[];
  currentLabel: string;
  /** Icon-only trigger (no label/chevron) for tight mobile rows -- the full
   * label still reaches screen readers via aria-label. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
      let left = rect.right - PANEL_WIDTH;
      left = Math.min(left, viewportWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
      left = Math.max(left, VIEWPORT_MARGIN);
      setPanelPos({ top: rect.bottom + 6, left });
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
        aria-expanded={open}
        aria-label={compact ? currentLabel : undefined}
        title={compact ? currentLabel : undefined}
        className={
          compact
            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-surface/80 text-muted backdrop-blur-md transition hover:border-accent/30 hover:text-foreground"
            : "flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/30"
        }
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {!compact && (
          <>
            {currentLabel}
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {open && panelPos && (
        <div
          className="fixed z-30 origin-top overflow-hidden rounded-xl border border-white/[0.08] bg-surface shadow-xl shadow-black/30 animate-[sort-dropdown-in_150ms_ease-out]"
          style={{ top: panelPos.top, left: panelPos.left, width: PANEL_WIDTH }}
        >
          {options.map((opt) => (
            <Link
              key={opt.key}
              href={opt.href}
              onClick={() => setOpen(false)}
              className={
                opt.active
                  ? "flex items-center justify-between gap-2 bg-accent/10 px-3.5 py-2.5 text-sm font-medium text-accent"
                  : "flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-foreground transition hover:bg-background"
              }
            >
              {opt.label}
              {opt.active && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
