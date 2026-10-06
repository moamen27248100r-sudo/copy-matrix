"use client";

import { useEffect, useRef, useState } from "react";
import { useMoney } from "@/lib/money-client";

// Renders the real value immediately (so server HTML and first paint are never
// a misleading "0"), then animates smoothly from the previous value to the new
// one whenever it changes, with a brief background flash.
export function CountUp({ value, prefix = "", money = false }: { value: number; prefix?: string; money?: boolean }) {
  const fmt = useMoney();
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState(0);
  const from = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs state with a browser API on mount
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
    setFlash((n) => n + 1);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span key={flash} className={flash > 0 ? "animate-value-flash rounded" : undefined}>
      {prefix}
      {money ? fmt(shown) : shown.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
    </span>
  );
}
