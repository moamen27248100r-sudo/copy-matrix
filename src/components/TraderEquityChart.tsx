"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AreaLineChart, type ChartPoint } from "@/components/charts/AreaLineChart";

// The leader's daily equity series (provider_daily_series): UTC days and each
// day's return on equity.
export type DailySeries = { days: string[]; ret: number[] };

const PERIODS: { labelKey: string; days: number | null }[] = [
  { labelKey: "periodWeek", days: 7 },
  { labelKey: "periodMonth", days: 30 },
  { labelKey: "periodThreeMonths", days: 90 },
  { labelKey: "periodYear", days: 365 },
  { labelKey: "periodAll", days: null },
];

const DAY = 24 * 60 * 60 * 1000;

function fmtPct(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function TraderEquityChart({ daily }: { daily: DailySeries | null }) {
  const t = useTranslations("TraderEquityChart");
  const tp = useTranslations("TradeHistory");
  const [periodIdx, setPeriodIdx] = useState(1);

  const { points, startT, endT } = useMemo(() => {
    const period = PERIODS[periodIdx];
    // Rounded to the start of the current UTC day, not the exact millisecond:
    // Date.now() computed fresh on both the server's SSR pass and the client's
    // hydration pass can differ by however long the request took, which can
    // flip whether a trade sitting right at the period boundary is included --
    // a real (if narrow) hydration mismatch. Day-granularity makes that
    // practically impossible without changing what "last 30 days" means.
    const now = new Date();
    const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    // N days = today and the N - 1 days before it, the same window as the
    // roi_7d / roi_30d / roi_90d stats (provider_daily rows with age < N).
    const cutoff = period.days != null ? todayUtcStart - (period.days - 1) * DAY : 0;
    const days = daily?.days ?? [];
    // Last millisecond of today, so the axis end and each day's closing point
    // read as that day and not as the following midnight.
    const end = todayUtcStart + DAY - 1;
    const firstDay = days.length > 0 ? Date.parse(days[0] + "T00:00:00Z") : todayUtcStart + DAY - 30 * DAY;
    const start = period.days != null ? cutoff : Math.min(firstDay, todayUtcStart);

    // Time-weighted return: each day's return compounds on the last, so
    // deposits and withdrawals never show up as gains or losses.
    let index = 1;
    const pts: ChartPoint[] = [{ v: 0, t: start }];
    days.forEach((day, i) => {
      const dayStart = Date.parse(day + "T00:00:00Z");
      if (dayStart < start) return;
      index *= 1 + Number(daily!.ret[i] ?? 0);
      pts.push({ v: (index - 1) * 100, t: Math.min(dayStart + DAY - 1, end) });
    });
    // A period with no closed trades still gets a flat line across the window.
    if (pts.length < 2) pts.push({ v: 0, t: end });
    return { points: pts, startT: start, endT: end };
  }, [daily, periodIdx]);

  const last = points[points.length - 1].v;
  const negative = last < 0;
  const domain = useMemo<[number, number]>(() => [startT, endT], [startT, endT]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group">
        {PERIODS.map((p, i) => (
          <button
            key={p.labelKey}
            type="button"
            aria-pressed={i === periodIdx}
            onClick={() => setPeriodIdx(i)}
            className={`min-h-8 rounded-full px-3.5 py-1 text-xs transition-colors duration-200 motion-reduce:transition-none ${
              i === periodIdx ? "bg-brand/25 text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {tp(p.labelKey)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border/50 bg-background p-3">
        <AreaLineChart points={points} format={fmtPct} ariaLabel={t("current")} timeAxis domain={domain} />
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>
            {t("start")}: <bdi dir="ltr">0%</bdi>
          </span>
          <span>
            {t("current")}:{" "}
            <bdi dir="ltr" className={`font-semibold ${negative ? "text-danger" : "text-foreground"}`}>
              {fmtPct(last)}
            </bdi>
          </span>
        </div>
      </div>
    </div>
  );
}
