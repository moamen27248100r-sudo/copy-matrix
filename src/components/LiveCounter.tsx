"use client";

import { useEffect, useState } from "react";

// Ticks the displayed number up/down by a small random step every
// couple of seconds, anchored to the real server-computed value —
// gives a "live" feel without ever drifting far from the real count.
export function LiveCounter({
  base,
  suffix = "",
  className,
}: {
  base: number;
  suffix?: string;
  className?: string;
}) {
  const [value, setValue] = useState(base);

  useEffect(() => {
    setValue(base);
    const id = setInterval(
      () => {
        setValue((prev) => {
          const step = Math.max(1, Math.round(base * 0.01));
          const next = prev + Math.round((Math.random() * 2 - 1) * step);
          const min = Math.round(base * 0.94);
          const max = Math.round(base * 1.06);
          return Math.min(max, Math.max(min, next));
        });
      },
      2500 + Math.random() * 1500,
    );
    return () => clearInterval(id);
  }, [base]);

  return (
    <p className={className} suppressHydrationWarning>
      {value.toLocaleString("en-US")}
      {suffix}
    </p>
  );
}
