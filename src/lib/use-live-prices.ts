"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MarketPriceRow = { symbol: string; price: number | string };

// Subscribes to real-time market_prices changes over Supabase's managed
// WebSocket (Realtime) -- pushes the instant a row actually changes,
// no polling interval on our side.
export function useLivePrices(symbols: string[], initialPrices: Record<string, number>) {
  const [prices, setPrices] = useState<Record<string, number>>(initialPrices);
  const key = symbols.join(",");

  useEffect(() => {
    console.log("[useLivePrices] effect running, symbols:", symbols);
    if (symbols.length === 0) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`market-prices-${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_prices" },
        (payload) => {
          const row = (payload.new ?? payload.old) as MarketPriceRow | null;
          if (!row || !symbols.includes(row.symbol)) return;
          console.log("[useLivePrices] tick received:", row);
          setPrices((prev) => ({ ...prev, [row.symbol]: Number(row.price) }));
        },
      )
      .subscribe((status, err) => {
        console.log("[useLivePrices] subscribe status:", status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return prices;
}
