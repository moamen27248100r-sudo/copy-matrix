"use client";

import Link from "next/link";
import { useState } from "react";

type FilterOption = { label: string; href: string; active: boolean };
type FilterSection = { label: string; options: FilterOption[] };

export function DiscoverFilterPanel({
  triggerLabel,
  closeLabel,
  sections,
  compact = false,
  active = false,
}: {
  triggerLabel: string;
  closeLabel: string;
  sections: FilterSection[];
  /** Icon-only trigger (no label) for tight mobile rows -- the full label
   * still reaches screen readers via aria-label. */
  compact?: boolean;
  /** Shows a small dot on the icon when at least one filter is applied,
   * so the icon-only trigger doesn't hide that state entirely. */
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={compact ? triggerLabel : undefined}
        title={compact ? triggerLabel : undefined}
        className={
          compact
            ? "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-surface/80 text-muted backdrop-blur-md transition hover:border-accent/30 hover:text-foreground"
            : "flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/30"
        }
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {!compact && triggerLabel}
        {compact && active && (
          <span className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 animate-[sort-dropdown-in_150ms_ease-out]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 end-0 flex w-full max-w-sm flex-col gap-5 overflow-y-auto border-s border-white/[0.08] bg-surface p-5 shadow-2xl scroll-subtle">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">{triggerLabel}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sections.map((section) => (
              <div key={section.label} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted">{section.label}</p>
                <div className="flex flex-wrap gap-2">
                  {section.options.map((opt) => (
                    <Link
                      key={opt.href}
                      href={opt.href}
                      onClick={() => setOpen(false)}
                      className={
                        opt.active
                          ? "rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
                          : "rounded-full border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent/30"
                      }
                    >
                      {opt.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
