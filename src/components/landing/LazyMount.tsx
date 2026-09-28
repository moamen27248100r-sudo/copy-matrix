"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Renders its children only once the placeholder is near the viewport, so
// heavy third-party widgets below the fold (TradingView) don't compete with
// the first paint. The placeholder keeps the final height to avoid layout shift.
export function LazyMount({ children, minHeight }: { children: ReactNode; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ minHeight }}>
      {visible ? children : null}
    </div>
  );
}
