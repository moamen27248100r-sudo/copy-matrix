"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 1000;

// Polls /api/prices once a second instead of relying on a long-lived Realtime
// WebSocket channel (which could go quiet without visibly recovering): every
// tick independently re-reads the current truth, so a bad tick self-heals on
// the next one. The endpoint serves ALL symbols from one CDN-cached response
// shared by every user, so the browser no longer queries the database itself;
// the cron behind it refreshes market_prices every 10s, so polling faster than
// that wouldn't show anything new beyond the cache.
export function useLivePricesMeta(symbols: string[], initialPrices: Record<string, number>) {
  const [prices, setPrices] = useState<Record<string, number>>(initialPrices);
  const [forexAsOf, setForexAsOf] = useState<Record<string, string>>({});
  const key = symbols.join(",");
  const symbolsRef = useRef(symbols);
  useEffect(() => {
    symbolsRef.current = symbols;
  });

  useEffect(() => {
    if (symbolsRef.current.length === 0) return;
    let stopped = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { prices: Record<string, number>; forexAsOf: Record<string, string> };
        if (stopped) return;
        setPrices((prev) => {
          const next = { ...prev };
          for (const s of symbolsRef.current) if (body.prices[s] != null) next[s] = body.prices[s];
          return next;
        });
        setForexAsOf(body.forexAsOf ?? {});
      } catch (error) {
        console.error("[useLivePrices] poll error:", error);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [key]);

  return { prices, forexAsOf };
}

export function useLivePrices(symbols: string[], initialPrices: Record<string, number>) {
  return useLivePricesMeta(symbols, initialPrices).prices;
}
