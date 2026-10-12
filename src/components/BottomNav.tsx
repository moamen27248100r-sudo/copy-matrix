"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";

// Unified 24px line icons (1.75 stroke, round caps) drawn for the platform.
// Each tab has an outline form (inactive) and a filled form (active).
const ICONS = {
  home: {
    outline: (
      <>
        <path d="M4 11.2 12 4l8 7.2" />
        <path d="M6 10v9.5h12V10" />
        <path d="M10 19.5v-5h4v5" />
      </>
    ),
    filled: (
      <path
        d="M11.2 3.5a1.2 1.2 0 0 1 1.6 0l7.4 6.7a1 1 0 0 1 .3.7V19.5a1.5 1.5 0 0 1-1.5 1.5h-4v-6a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v6h-4A1.5 1.5 0 0 1 3.5 19.5V10.9a1 1 0 0 1 .3-.7z"
        fill="currentColor"
      />
    ),
  },
  discover: {
    outline: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9z" />
      </>
    ),
    filled: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9z" fill="var(--background)" stroke="var(--background)" />
      </>
    ),
  },
  myCopies: {
    outline: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2.5" />
        <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
      </>
    ),
    filled: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2.5" fill="currentColor" />
        <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
      </>
    ),
  },
  trades: {
    outline: (
      <>
        <path d="M7 4v16M7 8H5v6h2M7 14h2V8H7" />
        <path d="M17 4v16M17 10h-2v7h2M17 17h2v-7h-2" />
      </>
    ),
    filled: (
      <>
        <path d="M7 3.5v17M17 3.5v17" />
        <rect x="4.5" y="8" width="5" height="7" rx="1" fill="currentColor" />
        <rect x="14.5" y="10" width="5" height="7" rx="1" fill="currentColor" />
      </>
    ),
  },
  portfolio: {
    outline: (
      <>
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5z" />
        <path d="M4 8.5V6.2A2.2 2.2 0 0 1 6.2 4H16" />
        <circle cx="16" cy="13.5" r="1.2" />
      </>
    ),
    filled: (
      <>
        <path d="M4 8.5V6.2A2.2 2.2 0 0 1 6.2 4H16" />
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5z" fill="currentColor" />
        <circle cx="16" cy="13.5" r="1.3" fill="var(--background)" stroke="var(--background)" />
      </>
    ),
  },
};

let lastBox: { x: number; w: number } | null = null;

export function BottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: t("navHome"), icon: ICONS.home },
    { href: "/discover", label: t("navDiscover"), icon: ICONS.discover },
    { href: "/copies", label: t("navMyCopies"), icon: ICONS.myCopies },
    { href: "/trades", label: t("navTrades"), icon: ICONS.trades },
    { href: "/portfolio", label: t("navPortfolio"), icon: ICONS.portfolio },
  ];

  const activeIndex = items.findIndex((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  // Every page mounts its own nav, so the last indicator position is kept at module
  // level: a new page starts the pill where the previous page left it and slides it
  // to the new tab. The very first mount has no previous position and just snaps.
  const [box, setBox] = useState<{ x: number; w: number } | null>(lastBox);
  const [ready, setReady] = useState(lastBox !== null);

  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
      const next = el ? { x: el.offsetLeft, w: el.offsetWidth } : null;
      if (next) lastBox = next;
      if (animate) {
        // two frames so the browser paints the starting position first
        raf = requestAnimationFrame(() => {
          raf = requestAnimationFrame(() => {
            setBox(next);
            setReady(true);
          });
        });
      } else {
        setBox(next);
      }
    };
    let raf = 0;
    measure(lastBox !== null);
    if (lastBox === null) raf = requestAnimationFrame(() => setReady(true));
    const onResize = () => measure(false);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [activeIndex]);

  return (
    <>
      {/* Publishes the nav's full footprint (capsule + its offset from the
          screen bottom + the safe area + a small gap) so every page's bottom
          padding and the sticky copy bar track it; 0 from lg up, where the
          nav is hidden. Capsule is 58px tall, floats 12px above the bottom. */}
      <style>{`:root{--bottom-nav-h:calc(58px + 12px + 8px + env(safe-area-inset-bottom,0px))}@media(min-width:1024px){:root{--bottom-nav-h:0px}}`}</style>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[9998] px-3 lg:hidden"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        <nav
          className="glass-nav pointer-events-auto relative mx-auto flex h-[58px] max-w-md items-stretch gap-1 rounded-full p-1 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          aria-label={t("menuAriaLabel")}
        >
          {box && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-0 top-1 bottom-1 ${
                ready ? "transition-transform duration-[350ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none" : ""
              }`}
              style={{ width: box.w, transform: `translateX(${box.x}px)` }}
            >
              <span key={activeIndex} className="glass-nav-pill block h-full w-full rounded-full" />
            </span>
          )}
          {items.map((item, i) => {
            const active = i === activeIndex;
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                aria-current={active ? "page" : undefined}
                className={`relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[11px] font-medium transition-colors duration-200 motion-reduce:transition-none ${
                  active ? "text-accent-text" : "text-muted active:text-foreground"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {active ? item.icon.filled : item.icon.outline}
                </svg>
                <span className="w-full truncate text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
