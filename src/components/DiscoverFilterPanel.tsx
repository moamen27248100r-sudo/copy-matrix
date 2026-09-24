"use client";

import Link from "next/link";
import { useState } from "react";

type FilterOption = { label: string; href: string; active: boolean };
type FilterSection = { label: string; options: FilterOption[] };

export function DiscoverFilterPanel({
  triggerLabel,
  closeLabel,
  sections,
}: {
  triggerLabel: string;
  closeLabel: string;
  sections: FilterSection[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-surface px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/30"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {triggerLabel}
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
