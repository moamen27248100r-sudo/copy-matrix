"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useInView } from "@/components/landing/useInView";

// A big number that counts up from 0 the first time it scrolls into view.
// The server HTML already contains the final value (no-JS / reduced motion).
export function CountOnView({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  signed = false,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  signed?: boolean;
  className?: string;
}) {
  const { ref, inView, reduced } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(value);
  const [armed, setArmed] = useState(false);

  // Before the first paint after hydration, drop to 0 so the count starts cleanly.
  useLayoutEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(0);
      setArmed(true);
    }
  }, []);

  useEffect(() => {
    if (!armed || !inView || reduced) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [armed, inView, reduced, value]);

  const abs = Math.abs(shown).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sign = signed ? (value >= 0 ? "+" : "-") : shown < 0 ? "-" : "";
  return (
    <span ref={ref} className={className}>
      {sign}
      {prefix}
      {abs}
      {suffix}
    </span>
  );
}
