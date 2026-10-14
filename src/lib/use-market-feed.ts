"use client";

import { useEffect, useRef, useState } from "react";

export type FeedQuote = { p: number; c: number | null; h: number | null; l: number | null };
export type Flash = Record<string, "up" | "down" | undefined>;

// Live prices for the Markets pages without reloading the page: one request returns every
// instrument (/api/markets/prices), it repeats every few seconds only while the page is visible,
// and it stops when the tab is hidden. A change of price sets a short-lived "up" / "down" flash.
export function useMarketFeed(initial: Record<string, FeedQuote>, intervalMs = 5000) {
  const [quotes, setQuotes] = useState(initial);
  const [flash, setFlash] = useState<Flash>({});
  const latest = useRef(initial);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;

    async function tick() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/markets/prices", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { rows: { s: string; p: number; c: number | null; h: number | null; l: number | null }[] };
        const next: Record<string, FeedQuote> = { ...latest.current };
        const changed: Flash = {};
        for (const r of body.rows) {
          const before = latest.current[r.s]?.p;
          next[r.s] = { p: r.p, c: r.c, h: r.h, l: r.l };
          if (before != null && r.p !== before) changed[r.s] = r.p > before ? "up" : "down";
        }
        latest.current = next;
        if (!stopped) {
          setQuotes(next);
          if (Object.keys(changed).length) {
            setFlash((f) => ({ ...f, ...changed }));
            const id = window.setTimeout(() => {
              setFlash((f) => {
                const copy = { ...f };
                for (const k of Object.keys(changed)) delete copy[k];
                return copy;
              });
            }, 700);
            timers.current.push(id);
          }
        }
      } catch {
        // a missed update is harmless: the next one catches up
      }
    }

    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(tick, intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void tick();
        start();
      } else {
        window.clearInterval(timer);
      }
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    const pending = timers.current;
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      pending.forEach((id) => window.clearTimeout(id));
    };
  }, [intervalMs]);

  return { quotes, flash };
}
