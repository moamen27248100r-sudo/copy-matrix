"use client";

import { AreaLineChart, type ChartPoint } from "@/components/charts/AreaLineChart";
import { useMoney } from "@/lib/money-client";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/money";
import type { Locale } from "@/i18n/locales";

type ClosedPosition = {
  pnl: number | null;
  closed_at: string | null;
};

const PERIODS: { labelKey: string; days: number | null }[] = [
  { labelKey: "periodDay", days: 1 },
  { labelKey: "periodWeek", days: 7 },
  { labelKey: "periodMonth", days: 30 },
  { labelKey: "period3Months", days: 90 },
  { labelKey: "periodYear", days: 365 },
  { labelKey: "periodAll", days: null },
];

export function MyEquityChart({ positions }: { positions: ClosedPosition[] }) {
  const t = useTranslations("Dashboard");
  const money = useMoney();
  const locale = useLocale() as Locale;
  const [periodIdx, setPeriodIdx] = useState(2);

  const points = useMemo(() => {
    const period = PERIODS[periodIdx];
    // Rounded to the start of the current UTC day -- see TraderEquityChart
    // for why: Date.now() computed fresh during both the server's SSR pass
    // and the client's hydration pass can differ enough to flip whether a
    // trade right at the boundary is included, causing a hydration mismatch.
    const now = new Date();
    const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const cutoff = period.days != null ? todayUtcStart - period.days * 24 * 60 * 60 * 1000 : 0;
    const closed = positions
      .filter((p) => p.closed_at && new Date(p.closed_at).getTime() >= cutoff)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

    let cumulative = 0;
    const firstT = closed.length > 0 ? new Date(closed[0].closed_at!).getTime() : todayUtcStart;
    const pts: ChartPoint[] = [{ v: 0, t: period.days != null ? cutoff : firstT }];
    for (const p of closed) {
      cumulative += p.pnl ?? 0;
      pts.push({ v: cumulative, t: new Date(p.closed_at!).getTime() });
    }
    return pts;
  }, [positions, periodIdx]);

  const hasData = points.length >= 3;
  const last = points[points.length - 1]?.v ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {PERIODS.map((p, i) => (
          <button
            key={p.labelKey}
            type="button"
            onClick={() => setPeriodIdx(i)}
            className={
              i === periodIdx
                ? "rounded-full bg-brand/25 px-2 py-1 text-xs text-white"
                : "rounded-full px-2 py-1 text-xs text-muted"
            }
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {!hasData ? (
        <p className="text-sm text-muted">{t("noEnoughClosedTrades")}</p>
      ) : (
        <div className="rounded-lg border border-border bg-background p-3">
          <AreaLineChart
            points={points}
            format={(v) => money(v)}
            axisFormat={(v) => formatNumber(v, locale, Number.isInteger(v) ? 0 : 2)}
            ariaLabel={t("startingPoint", { amount: money(0) })}
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{t("startingPoint", { amount: money(0) })}</span>
            <span className={`font-semibold ${last >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
              {money(last, { signed: true })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
