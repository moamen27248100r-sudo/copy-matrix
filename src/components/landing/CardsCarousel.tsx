"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

// A horizontal strip of cards that snaps into place.
//   phones:  one card ~85% wide so the edge of the next one shows, swipe to scroll, dots below
//   desktop: three cards visible, a calm round arrow on each side
// Works in both reading directions (cards are placed by the container's `direction`, and the
// active card is found from the start edge of the container).
export function CardsCarousel({ children, prevLabel, nextLabel }: { children: ReactNode; prevLabel: string; nextLabel: string }) {
  const items = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const box = el.getBoundingClientRect();
    const edge = rtl ? box.right : box.left;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = Math.abs((rtl ? r.right : r.left) - edge);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    onScroll();
  }, [onScroll]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    const child = el?.children[Math.max(0, Math.min(items.length - 1, i))] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const lastStart = Math.max(0, items.length - 3); // three cards are visible on desktop
  const arrow =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-background/80 text-[var(--text-secondary)] backdrop-blur transition hover:border-white/25 hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-0 md:flex";

  return (
    <div className="relative">
      <button type="button" aria-label={prevLabel} disabled={active <= 0} onClick={() => goTo(active - 1)} className={`${arrow} -start-5`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button type="button" aria-label={nextLabel} disabled={active >= lastStart} onClick={() => goTo(active + 1)} className={`${arrow} -end-5`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="no-scrollbar -my-2 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth py-2"
      >
        {items.map((child, i) => (
          <div key={i} className="shrink-0 snap-start">
            {child}
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-0.5 md:hidden" role="group">
        {items.map((_, i) => (
          <button key={i} type="button" onClick={() => goTo(i)} aria-label={String(i + 1)} aria-current={i === active} className="flex h-6 w-6 items-center justify-center">
            <span className={`block h-2 rounded-full transition-all ${i === active ? "w-5 bg-[var(--text-accent)]" : "w-2 bg-white/25"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
