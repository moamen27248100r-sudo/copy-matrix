"use client";

import { useEffect, useRef } from "react";

// Sticky "copy" action bar. Below lg it is fixed right above the bottom nav
// with a solid platform-colored background (no transparency/blur, so page
// content never shows through); from lg up it is a plain inline block. Its
// measured height is published as --copy-bar-h so the page can reserve
// exactly that much bottom padding.
export function CopyBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      const fixed = getComputedStyle(el).position === "fixed";
      root.style.setProperty("--copy-bar-h", fixed ? `${el.offsetHeight}px` : "0px");
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--copy-bar-h");
    };
  }, []);

  return (
    <div
      ref={ref}
      id="copy"
      className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-40 border-t border-border bg-background px-4 py-3 shadow-[0_-6px_16px_rgba(0,0,0,0.35)] scroll-mt-20 lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </div>
  );
}
