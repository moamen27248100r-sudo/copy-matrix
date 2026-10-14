"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AreaLineChart, type ChartPoint } from "@/components/charts/AreaLineChart";
import { formatPrice } from "@/lib/markets";
import { useMarketFeed } from "@/lib/use-market-feed";

const RANGES = ["1D", "1W", "1M", "3M", "1Y"] as const;
type Range = (typeof RANGES)[number];

// The instrument's price chart, in the platform's chart style, with the period bar under it
// (1D | 1W | 1M | 3M | 1Y). The first range comes with the page; the others are fetched when chosen.
export function InstrumentChart({
  symbol,
  initial,
  decimals,
  label,
}: {
  symbol: string;
  initial: ChartPoint[];
  decimals: number;
  label: string;
}) {
  const t = useTranslations("Markets");
  const [range, setRange] = useState<Range>("1D");
  const cache = useRef<Partial<Record<Range, ChartPoint[]>>>({ "1D": initial });
  const [points, setPoints] = useState<ChartPoint[]>(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = cache.current[range];
    if (cached) {
      const id = setTimeout(() => setPoints(cached), 0);
      return () => clearTimeout(id);
    }
    let alive = true;
    const start = setTimeout(() => setLoading(true), 0);
    fetch(`/api/markets/history?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => (r.ok ? r.json() : { points: [] }))
      .then((body: { points: { t: number; v: number }[] }) => {
        const pts = (body.points ?? []).map((p) => ({ t: p.t, v: p.v }));
        cache.current[range] = pts;
        if (alive) setPoints(pts);
      })
      .catch(() => alive && setPoints([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      clearTimeout(start);
    };
  }, [range, symbol]);

  return (
    <div className="flex flex-col gap-3">
      {points.length < 3 ? (
        <p className="rounded-lg border border-border bg-background px-3 py-10 text-center text-sm text-muted">{loading ? "…" : t("noHistory")}</p>
      ) : (
        <div className="rounded-lg border border-border bg-background p-3">
          <AreaLineChart
            points={points}
            timeAxis
            height={260}
            format={(v) => formatPrice(v, decimals)}
            axisFormat={(v) => formatPrice(v, decimals)}
            ariaLabel={label}
            fadeKey={range}
          />
        </div>
      )}
      <div className="flex rounded-full bg-black/25 p-1" role="group">
        {RANGES.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={range === k}
            onClick={() => setRange(k)}
            className={`tap-44 min-h-8 flex-1 rounded-full px-2 py-1 text-xs transition-colors ${range === k ? "bg-brand/25 text-white" : "text-muted hover:text-foreground"}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// The big price of the instrument page: refreshes with the market feed and flashes softly.
export function LivePrice({ symbol, price, change, decimals, daily }: { symbol: string; price: number; change: number | null; decimals: number; daily: boolean }) {
  const t = useTranslations("Markets");
  const { quotes, flash } = useMarketFeed({ [symbol]: { p: price, c: change, h: null, l: null } });
  const q = quotes[symbol];
  const c = q?.c ?? change;
  const f = flash[symbol];
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-3" dir="ltr">
      <span className={`rounded px-1 text-3xl font-bold tabular-nums transition-colors duration-500 ${f === "up" ? "bg-success/25" : f === "down" ? "bg-danger/25" : ""}`}>
        {formatPrice(q?.p ?? price, decimals)}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${c == null ? "text-muted" : c >= 0 ? "text-success" : "text-danger"}`}>
        {c == null ? "—" : `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`}
      </span>
      <span className="text-xs text-muted">{daily ? t("dailyRate") : t("last24h")}</span>
    </p>
  );
}
