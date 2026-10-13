"use client";

import { useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FOREX_SYMBOLS } from "@/lib/pip-specs";
import { useLivePrices } from "@/lib/use-live-prices";
import { isRtlLocale, type Locale } from "@/i18n/locales";

// Every instrument the platform has a live price for (market_prices): gold, the three forex pairs
// and five crypto assets. Silver and oil are not instruments of this platform, so they are not shown.
// Codes are instrument symbols and stay as they are in every language.
const TICKER_MARKETS: {
  dbSymbol: string;
  label: string;
  glyph: string;
  iconClasses: string;
  decimals: number;
}[] = [
  { dbSymbol: "XAUUSD", label: "XAU/USD", glyph: "Au", iconClasses: "text-amber-400 bg-amber-500/10", decimals: 2 },
  { dbSymbol: "EURUSD", label: "EUR/USD", glyph: "€", iconClasses: "text-blue-400 bg-blue-500/10", decimals: 4 },
  { dbSymbol: "GBPUSD", label: "GBP/USD", glyph: "£", iconClasses: "text-sky-400 bg-sky-500/10", decimals: 4 },
  { dbSymbol: "USDJPY", label: "USD/JPY", glyph: "¥", iconClasses: "text-rose-400 bg-rose-500/10", decimals: 3 },
  { dbSymbol: "BTCUSDT", label: "BTC/USDT", glyph: "₿", iconClasses: "text-orange-400 bg-orange-500/10", decimals: 0 },
  { dbSymbol: "ETHUSDT", label: "ETH/USDT", glyph: "Ξ", iconClasses: "text-indigo-300 bg-indigo-500/10", decimals: 0 },
  { dbSymbol: "BNBUSDT", label: "BNB/USDT", glyph: "B", iconClasses: "text-yellow-400 bg-yellow-500/10", decimals: 1 },
  { dbSymbol: "SOLUSDT", label: "SOL/USDT", glyph: "S", iconClasses: "text-emerald-300 bg-emerald-500/10", decimals: 2 },
  { dbSymbol: "XRPUSDT", label: "XRP/USDT", glyph: "X", iconClasses: "text-slate-300 bg-slate-500/10", decimals: 4 },
];

// Enough copies for the track to be wider than any screen; it scrolls exactly one copy's width per
// cycle, so the loop point is invisible and there is never a gap.
const COPIES = 4;

export function MarketTicker({ initialPrices }: { initialPrices: Record<string, number> }) {
  const tl = useTranslations("LivePrices");
  const locale = useLocale() as Locale;
  const rtl = isRtlLocale(locale);
  const symbols = TICKER_MARKETS.map((m) => m.dbSymbol);
  const prices = useLivePrices(symbols, initialPrices);

  // Baseline captured once, on the first real prices of this session, so the percentage is a
  // genuine live delta off real numbers (market_prices only stores the current price).
  /* eslint-disable react-hooks/refs -- intentional write-once baseline per symbol */
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
  /* eslint-enable react-hooks/refs */

  if (items.length === 0) return null;

  const fmt = (n: number, d: number) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div
      className="relative mt-1 -mx-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] sm:-mx-8"
      aria-label={tl("tickerLabel")}
      role="marquee"
    >
      <div
        // Items flow from the start edge; the track moves toward the end edge so the content that
        // leaves is replaced by the next copy without a gap, in both reading directions.
        className={`flex w-max items-center hover:[animation-play-state:paused] ${rtl ? "animate-[ticker-scroll-rtl_40s_linear_infinite]" : "animate-[ticker-scroll-ltr_40s_linear_infinite]"}`}
      >
        {Array.from({ length: COPIES }, (_, copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy > 0}>
            {items.map((item) => (
              <div key={item.dbSymbol} className="flex shrink-0 items-center gap-1.5 pe-6 text-xs">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${item.iconClasses}`}>
                  {item.glyph}
                </span>
                <span dir="ltr" className="font-medium text-slate-300">
                  {item.label}
                </span>
                <span dir="ltr" className="font-semibold text-white">
                  {fmt(item.price, item.decimals)}
                </span>
                {FOREX_SYMBOLS.includes(item.dbSymbol) ? (
                  <span className="text-[10px] text-slate-400">{tl("forexDailyNoDate")}</span>
                ) : (
                  <span dir="ltr" className={`font-medium ${item.changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {item.changePct >= 0 ? "+" : ""}
                    {item.changePct.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
