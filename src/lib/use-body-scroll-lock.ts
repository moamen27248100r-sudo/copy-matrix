"use client";

import { useEffect } from "react";

// `overflow: hidden` on <body> alone doesn't stop background scrolling on
// iOS Safari (its touch-scroll bypasses that), which is what caused the
// page behind an open drawer/panel to visibly scroll/bounce. Pinning the
// body to `position: fixed` at its current scroll offset removes it from
// the scrollable viewport entirely, then restores the exact position on
// close — this is the standard cross-browser-safe lock.
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
