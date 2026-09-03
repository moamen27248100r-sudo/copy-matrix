"use client";

import { useEffect, useRef } from "react";
import { symbolTradingViewTicker } from "@/lib/symbol-icons";

// A real, live TradingView chart for the exact instrument a post is about —
// always current, never a stale screenshot. Reuses the same TradingView
// embed the platform already runs on the markets page and trader profile
// (TradingViewChart.tsx), just the lightweight "mini symbol overview"
// widget so a whole feed of these stays light.
export function TraderPostMiniChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbolTradingViewTicker(symbol),
      width: "100%",
      height: 90,
      locale: "ar",
      dateRange: "1D",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      chartOnly: true,
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="h-[90px] w-full overflow-hidden rounded-lg border border-border">
      <div className="tradingview-widget-container h-full w-full" ref={containerRef}>
        <div className="tradingview-widget-container__widget h-full w-full" />
      </div>
    </div>
  );
}
