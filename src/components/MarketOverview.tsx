"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locales";
import { TRADINGVIEW_LOCALES } from "@/lib/tradingview-locale";

export function MarketOverview() {
  const locale = useLocale() as Locale;
  const t = useTranslations("MarketOverview");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      dateRange: "12M",
      showChart: false,
      locale: TRADINGVIEW_LOCALES[locale] ?? "en",
      width: "100%",
      height: "100%",
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      plotLineColorGrowing: "rgba(47, 111, 237, 1)",
      plotLineColorFalling: "rgba(47, 111, 237, 1)",
      gridLineColor: "rgba(240, 243, 250, 0)",
      scaleFontColor: "rgba(120, 123, 134, 1)",
      belowLineFillColorGrowing: "rgba(47, 111, 237, 0.12)",
      belowLineFillColorFalling: "rgba(47, 111, 237, 0.12)",
      belowLineFillColorGrowingBottom: "rgba(47, 111, 237, 0)",
      belowLineFillColorFallingBottom: "rgba(47, 111, 237, 0)",
      symbolActiveColor: "rgba(47, 111, 237, 0.12)",
      tabs: [
        {
          title: t("crypto"),
          symbols: [
            { s: "BINANCE:BTCUSDT" },
            { s: "BINANCE:ETHUSDT" },
            { s: "BINANCE:SOLUSDT" },
            { s: "BINANCE:BNBUSDT" },
            { s: "BINANCE:XRPUSDT" },
          ],
        },
        {
          title: t("forex"),
          symbols: [
            { s: "OANDA:XAUUSD" },
            { s: "OANDA:EURUSD" },
            { s: "OANDA:GBPUSD" },
            { s: "OANDA:USDJPY" },
          ],
        },
        {
          title: t("indices"),
          symbols: [{ s: "FOREXCOM:US30" }],
        },
      ],
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [locale, t]);

  return (
    <div className="h-[420px] w-full bg-background">
      <div className="tradingview-widget-container h-full w-full" ref={containerRef}>
        <div className="tradingview-widget-container__widget h-full w-full" />
      </div>
    </div>
  );
}
