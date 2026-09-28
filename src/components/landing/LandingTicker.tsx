"use client";

import { useRef } from "react";
import { useLivePrices } from "@/lib/use-live-prices";

// Same price source as the dashboard ticker (market_prices, polled every
// second). Only instruments that actually have a stored price are shown; the
// arrow reflects the last tick, not a fabricated daily change.
const ITEMS = [
  { symbol: "BTCUSDT", label: "BTC/USD", decimals: 0 },
  { symbol: "ETHUSDT", label: "ETH/USD", decimals: 0 },
  { symbol: "XAUUSD", label: "XAU/USD", decimals: 0 },
  { symbol: "EURUSD", label: "EUR/USD", decimals: 4 },
  { symbol: "SOLUSDT", label: "SOL/USD", decimals: 1 },
  { symbol: "BNBUSDT", label: "BNB/USD", decimals: 1 },
  { symbol: "XRPUSDT", label: "XRP/USD", decimals: 3 },
];

export function LandingTicker({ initialPrices, label }: { initialPrices: Record<string, number>; label: string }) {
  const prices = useLivePrices(ITEMS.map((i) => i.symbol), initialPrices);
  const last = useRef<Record<string, number>>({});
  const dir = useRef<Record<string, "up" | "down">>({});
  for (const i of ITEMS) {
    const p = prices[i.symbol];
    if (p && last.current[i.symbol] !== undefined && p !== last.current[i.symbol]) {
      dir.current[i.symbol] = p > last.current[i.symbol] ? "up" : "down";
    }
    if (p) last.current[i.symbol] = p;
  }
  const items = ITEMS.filter((i) => prices[i.symbol]);
  if (items.length === 0) return null;

  return (
    <div
      aria-label={label}
      dir="ltr"
      className="overflow-hidden border-b border-border [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
    >
      <div className="landing-marquee flex w-max items-center py-2.5" dir="ltr">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {items.map((i) => {
              const d = dir.current[i.symbol];
              return (
                <div key={i.symbol} className="flex shrink-0 items-center gap-2 px-5 text-sm">
                  <span className="text-muted">{i.label}</span>
                  <span className="num font-medium">
                    {prices[i.symbol].toLocaleString("en-US", { minimumFractionDigits: i.decimals, maximumFractionDigits: i.decimals })}
                  </span>
                  {d && <span className={`text-xs ${d === "up" ? "text-up" : "text-down"}`}>{d === "up" ? "▲" : "▼"}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
