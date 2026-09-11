"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 1000;

// Polls market_prices once a second instead of relying on a
// long-lived Realtime WebSocket channel. Realtime looked right in
// isolated testing (ticks genuinely arrived, state genuinely updated)
// but the channel could go quiet after the first update or two without
// visibly recovering, and re-diagnosing that blind, in production,
// was costing far more than it was worth. A short poll has no
// connection-state machine to get stuck in: every tick independently
// re-reads the current truth from the database, so even a bad tick
// self-heals on the very next one a second later. 1s matches the
// underlying fetch cadence (Binance -> market_prices) one-for-one --
// polling faster than the source itself updates wouldn't show
// anything new.
export function useLivePrices(symbols: string[], initialPrices: Record<string, number>) {
  const [prices, setPrices] = useState<Record<string, number>>(initialPrices);
  const key = symbols.join(",");
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;

  useEffect(() => {
    if (symbolsRef.current.length === 0) return;
    const supabase = createClient();
    let stopped = false;

    const tick = async () => {
      const { data, error } = await supabase
        .from("market_prices")
        .select("symbol, price")
        .in("symbol", symbolsRef.current);
      if (error) console.error("[useLivePrices] poll error:", error);
      if (stopped || error || !data) return;
      setPrices((prev) => {
        const next = { ...prev };
        for (const row of data) next[row.symbol] = Number(row.price);
        return next;
      });
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return prices;
}
