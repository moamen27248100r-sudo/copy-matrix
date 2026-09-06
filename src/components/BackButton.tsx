"use client";

import { useRouter } from "next/navigation";

// A brand-new tab can already report window.history.length as 2 or more
// for reasons unrelated to this app (how the tab was opened, an
// interstitial about:blank, browser-vendor quirks) — checking
// "length > 1" on every click can't tell that apart from a tab that's
// had a real in-app navigation, and sends "رجوع" to a blank page instead
// of somewhere real. Captured once per module load (persists across
// client-side route changes, only resets on an actual full page load),
// this is a stable baseline: back() only fires once history has grown
// since *this app session* began, not just because the number happens to
// be > 1.
const initialHistoryLength = typeof window !== "undefined" ? window.history.length : 0;

export function BackButton({ fallbackHref, label = "رجوع" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > initialHistoryLength) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="9 5 15 12 9 19" />
      </svg>
      {label}
    </button>
  );
}
