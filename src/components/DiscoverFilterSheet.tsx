"use client";

import Link from "next/link";
import { useState } from "react";

type RadioOption = { value: string; label: string };
type RadioSection = { name: string; label: string; options: RadioOption[]; current: string };

// Single consolidated filter entry point for the discover page: one
// button (with a badge showing how many filters are active) opens a
// glass bottom sheet containing every dimension -- quick categories,
// sort, risk, minimum entry, asset class, track record -- as native radio
// groups inside one <form method="get">. Submitting it navigates like any
// other GET form on this page (same pattern as the search box above it),
// so picking several options only takes effect once, on "Apply" --
// unlike the old per-pill Links that each navigated immediately.
export function DiscoverFilterSheet({
  triggerLabel,
  applyLabel,
  resetLabel,
  closeLabel,
  activeCount,
  q,
  resetHref,
  sections,
}: {
  triggerLabel: string;
  applyLabel: string;
  resetLabel: string;
  closeLabel: string;
  activeCount: number;
  q?: string;
  resetHref: string;
  sections: RadioSection[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] bg-surface/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-md transition hover:border-accent/30"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {triggerLabel}
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <form
            method="get"
            action="/discover"
            className="absolute inset-x-0 bottom-0 z-10 flex max-h-[85vh] flex-col gap-5 overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[#0B132B]/95 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:inset-x-auto sm:end-6 sm:top-16 sm:bottom-auto sm:w-96 sm:rounded-3xl sm:border"
          >
            {q && <input type="hidden" name="q" value={q} />}

            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">{triggerLabel}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] text-muted transition hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {sections.map((section) => (
              <fieldset key={section.name} className="flex flex-col gap-2">
                <legend className="pb-2 text-sm font-medium text-muted">{section.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {section.options.map((opt) => (
                    <label key={opt.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name={section.name}
                        value={opt.value}
                        defaultChecked={section.current === opt.value}
                        className="peer sr-only"
                      />
                      <span className="block rounded-full border border-white/[0.08] px-3.5 py-1.5 text-sm text-foreground transition peer-checked:border-accent/40 peer-checked:bg-accent/10 peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <div className="mt-2 flex gap-2 border-t border-white/[0.08] pt-4">
              <Link
                href={resetHref}
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-white/[0.08] px-4 py-2.5 text-center text-sm font-medium text-muted transition hover:text-foreground"
              >
                {resetLabel}
              </Link>
              <button
                type="submit"
                className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
              >
                {applyLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
