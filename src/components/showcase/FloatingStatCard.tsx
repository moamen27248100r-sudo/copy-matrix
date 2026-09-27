"use client";

import { useEffect, useState, type ReactNode } from "react";

// One shared glass shell for every floating card around the phone --
// each instance floats independently (its own animation-delay) so they
// never bob in sync.
export function FloatingStatCard({
  children,
  delaySeconds,
  reducedMotion,
  className = "",
}: {
  children: ReactNode;
  delaySeconds: number;
  reducedMotion: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={
        "rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-xl shadow-black/40 backdrop-blur-xl " +
        (reducedMotion ? "" : "showcase-card-float ") +
        className
      }
      style={{ animationDelay: reducedMotion ? undefined : `${delaySeconds}s` }}
    >
      {children}
      <style>{`
        @keyframes showcaseCardFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .showcase-card-float {
          animation: showcaseCardFloat 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Counts up from 0 to `value` once, the first time it becomes visible --
// a short self-terminating interval, not a persistent timer.
export function CountUpNumber({ value, start }: { value: number; start: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!start) return;
    const durationMs = 1000;
    const steps = 24;
    const stepMs = durationMs / steps;
    let step = 0;
    const id = setInterval(() => {
      step += 1;
      const progress = Math.min(1, step / steps);
      setDisplay(Math.round(value * progress));
      if (progress >= 1) clearInterval(id);
    }, stepMs);
    return () => clearInterval(id);
  }, [start, value]);

  return <span dir="ltr">{display.toLocaleString("en-US")}</span>;
}
