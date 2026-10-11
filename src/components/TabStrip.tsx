"use client";

import { useEffect, useRef } from "react";

// A horizontally scrollable strip of tab links. The active one (aria-current)
// is brought into view, so on a narrow phone the selected tab is never the
// one hiding off the edge.
export function TabStrip({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = ref.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    // Scroll the strip itself, never the page.
    const target = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
    strip.scrollTo({ left: target, behavior: "auto" });
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
