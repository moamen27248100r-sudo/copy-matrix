"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/locales";

// TradingView's widget only recognizes a fixed locale list of its own;
// languages it doesn't support (confirmed: ur, bn, sw) fall back to English
// rather than passing an unrecognized code the widget would silently ignore
// in an unpredictable way.
const TRADINGVIEW_LOCALES: Record<Locale, string> = {
  ar: "ar", en: "en", fr: "fr", es: "es", pt: "pt",
  zh: "zh_CN", hi: "hi_IN", id: "id_ID", vi: "vi_VN", th: "th_TH",
  ur: "en", bn: "en", sw: "en",
};

export function TradingViewChart({ symbol = "OANDA:XAUUSD" }: { symbol?: string }) {
  const locale = useLocale() as Locale;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "1",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: TRADINGVIEW_LOCALES[locale] ?? "en",
      backgroundColor: "rgba(0, 0, 0, 1)",
      gridColor: "rgba(255, 255, 255, 0.06)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, locale]);

  return (
    <div className="h-[500px] w-full bg-background">
      <div className="tradingview-widget-container h-full w-full" ref={containerRef}>
        <div className="tradingview-widget-container__widget h-full w-full" />
      </div>
    </div>
  );
}
