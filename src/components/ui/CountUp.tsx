"use client";

import { useEffect, useRef, useState } from "react";

// Animates a number from 0 (first paint) or from its previous value to the
// new one, and flashes the background briefly when it changes afterwards.
export function CountUp({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [shown, setShown] = useState(0);
  const [flash, setFlash] = useState(0);
  const from = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(origin + (value - origin) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    if (!first.current) setFlash((n) => n + 1);
    first.current = false;
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span key={flash} className={flash > 0 ? "animate-value-flash rounded" : undefined}>
      {prefix}
      {shown.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
    </span>
  );
}
