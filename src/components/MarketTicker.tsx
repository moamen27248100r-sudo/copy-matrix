"use client";

import { useRef } from "react";
import { useLivePrices } from "@/lib/use-live-prices";

// Real DB symbols (see market_prices / migration 0072_real_market_prices.sql):
// BTCUSDT and XAUUSD (via Binance's PAXGUSDT) refresh live every minute,
// EURUSD refreshes daily from the ECB feed, US30 has no free live source
// and is intentionally excluded rather than faking a number for it.
const TICKER_MARKETS: {
  dbSymbol: string;
  label: string;
  glyph: string;
  iconClasses: string;
  format: (price: number) => string;
}[] = [
  {
    dbSymbol: "BTCUSDT",
    label: "BTC/USD",
    glyph: "₿",
    iconClasses: "text-orange-400 bg-orange-500/10",
    format: (p) => `$${Math.round(p).toLocaleString("en-US")}`,
  },
  {
    dbSymbol: "XAUUSD",
    label: "GOLD",
    glyph: "Au",
    iconClasses: "text-amber-400 bg-amber-500/10",
    format: (p) => `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  },
  {
    dbSymbol: "EURUSD",
    label: "EUR/USD",
    glyph: "€$",
    iconClasses: "text-blue-400 bg-blue-500/10",
    format: (p) => p.toFixed(4),
  },
];

export function MarketTicker({ initialPrices }: { initialPrices: Record<string, number> }) {
  const symbols = TICKER_MARKETS.map((m) => m.dbSymbol);
  const prices = useLivePrices(symbols, initialPrices);

  // Baseline captured once, on first real prices this session, so the
  // percentage is a genuine live delta off real numbers rather than a
  // fabricated figure -- it just isn't a 24h-open change, since
  // market_prices only ever stores the current price.
  const baselineRef = useRef<Record<string, number>>({});
  for (const symbol of symbols) {
    if (baselineRef.current[symbol] === undefined && prices[symbol]) {
      baselineRef.current[symbol] = prices[symbol];
    }
  }

  const items = TICKER_MARKETS.map((m) => {
    const price = prices[m.dbSymbol];
    const baseline = baselineRef.current[m.dbSymbol];
    const changePct = price && baseline ? ((price - baseline) / baseline) * 100 : 0;
    return { ...m, price, changePct };
  }).filter((item) => item.price);

  if (items.length === 0) return null;

  return (
    <div
      className="relative mt-1 -mx-6 overflow-hidden px-6 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] sm:-mx-8 sm:px-8"
    >
      <div className="flex w-max animate-[ticker-scroll_28s_linear_infinite] items-center hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {items.map((item, i) => (
              <div key={item.dbSymbol} className="flex shrink-0 items-center gap-1.5 text-xs">
                {i > 0 && <span className="mx-3 text-slate-600">·</span>}
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${item.iconClasses}`}>
                  {item.glyph}
                </span>
                <span className="font-medium text-slate-300">{item.label}</span>
                <span dir="ltr" className="font-semibold text-white">
                  {item.format(item.price)}
                </span>
                <span dir="ltr" className={`font-medium ${item.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {item.changePct >= 0 ? "+" : ""}
                  {item.changePct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
