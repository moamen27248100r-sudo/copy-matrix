"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AreaLineChart, type ChartPoint } from "@/components/charts/AreaLineChart";
import { formatPrice } from "@/lib/markets";

// The instrument's price chart, in the platform's chart style: a day (5-minute points) or a week
// (30-minute points), switched with the same rounded period bar as the wallet.
export function InstrumentChart({
  day,
  week,
  decimals,
  label,
}: {
  day: ChartPoint[];
  week: ChartPoint[];
  decimals: number;
  label: string;
}) {
  const t = useTranslations("Markets");
  const [range, setRange] = useState<"day" | "week">("day");
  const points = range === "day" ? day : week;

  return (
    <div className="flex flex-col gap-3">
      {points.length < 3 ? (
        <p className="rounded-lg border border-border bg-background px-3 py-10 text-center text-sm text-muted">{t("noData")}</p>
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
        {(["day", "week"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={range === k}
            onClick={() => setRange(k)}
            className={`tap-44 min-h-8 flex-1 rounded-full px-3 py-1 text-xs transition-colors ${range === k ? "bg-brand/25 text-white" : "text-muted hover:text-foreground"}`}
          >
            {k === "day" ? t("rangeDay") : t("rangeWeek")}
          </button>
        ))}
      </div>
    </div>
  );
}
