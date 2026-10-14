"use client";

import { AreaLineChart, type ChartPoint } from "@/components/charts/AreaLineChart";
import { useMoney } from "@/lib/money-client";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/money";
import { formatPct, profitPct } from "@/lib/profit-pct";
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

type Bench = "off" | "BTCUSDT" | "XAUUSD";

// Reference price lines per symbol and period (days; "0" = all time), read once with the page from
// the database cache (benchmark_bundle, refreshed every few minutes) so switching is instant.
export type Benchmarks = Record<string, Record<string, { t: number; p: number }[]>>;

const PERIOD_SUMMARY_KEY: Record<string, string> = {
  periodDay: "periodSummaryDay",
  periodWeek: "periodSummaryWeek",
  periodMonth: "periodSummaryMonth",
  period3Months: "periodSummary3Months",
  periodYear: "periodSummaryYear",
  periodAll: "periodSummaryAll",
};

export function MyEquityChart({
  positions,
  netInvested = null,
  benchmarks = null,
  wallet = false,
}: {
  positions: ClosedPosition[];
  netInvested?: number | null;
  benchmarks?: Benchmarks | null;
  /** The wallet card layout: result line for the period above the chart, the period buttons in one
   *  rounded bar under it, and a calm flat line (with a hint) while there is no closed trade yet. */
  wallet?: boolean;
}) {
  const t = useTranslations("Dashboard");
  const money = useMoney();
  const locale = useLocale() as Locale;
  const [periodIdx, setPeriodIdx] = useState(2);
  const [bench, setBench] = useState<Bench>("off");
  const chooseBench = (next: Bench) => setBench(next);
  const choosePeriod = (i: number) => setPeriodIdx(i);

  const { points, cutoff, firstT } = useMemo(() => {
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
    return { points: pts, cutoff, firstT };
  }, [positions, periodIdx]);

  const hasData = points.length >= 3;
  const last = points[points.length - 1]?.v ?? 0;

  // Comparison view: both lines as % return since the start of the period -- the portfolio's
  // result over net invested funds, and the reference market's price change.
  const compare = useMemo(() => {
    if (bench === "off" || !benchmarks) return null;
    if (netInvested == null || netInvested <= 0) return null;
    const start = PERIODS[periodIdx].days != null ? cutoff : firstT;
    const series = benchmarks[bench]?.[String(PERIODS[periodIdx].days ?? 0)] ?? [];
    const ref = series.filter((p) => p.t >= start);
    // The chart ends at the newest reference price, so both lines cover the same span.
    const end = ref.length > 0 ? ref[ref.length - 1].t : start;
    if (ref.length < 2) return null;
    const base = ref[0].p;
    if (!(base > 0)) return null;
    const own: ChartPoint[] = points.map((p) => ({ t: p.t, v: profitPct(p.v, netInvested) ?? 0 }));
    own.push({ t: end, v: own[own.length - 1]?.v ?? 0 });
    const line: ChartPoint[] = ref.map((p) => ({ t: p.t, v: (p.p / base - 1) * 100 }));
    return { own, line, start, end, ownLast: own[own.length - 1].v, refLast: line[line.length - 1].v };
  }, [bench, benchmarks, netInvested, points, periodIdx, cutoff, firstT]);

  const canCompare = netInvested != null && netInvested > 0 && benchmarks != null && Object.keys(benchmarks).length > 0;
  const benchOptions: { key: Bench; label: string }[] = [
    { key: "off", label: t("benchmarkOff") },
    { key: "BTCUSDT", label: t("benchmarkBtc") },
    { key: "XAUUSD", label: t("benchmarkGold") },
  ];

  const periodBar = wallet ? (
    <div className="flex rounded-full bg-black/25 p-1" role="group">
      {PERIODS.map((p, i) => (
        <button
          key={p.labelKey}
          type="button"
          aria-pressed={i === periodIdx}
          onClick={() => choosePeriod(i)}
          className={`tap-44 min-h-8 flex-1 rounded-full px-1 py-1 text-xs transition-colors duration-200 motion-reduce:transition-none ${
            i === periodIdx ? "bg-brand/25 text-white" : "text-muted hover:text-foreground"
          }`}
        >
          {t(p.labelKey)}
        </button>
      ))}
    </div>
  ) : (
    <div className="flex flex-wrap gap-1">
      {PERIODS.map((p, i) => (
        <button
          key={p.labelKey}
          type="button"
          onClick={() => choosePeriod(i)}
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
  );

  // The result of the selected period: "+$120 (+1.2%) this month".
  const periodPct = profitPct(last, netInvested);
  const summaryLine = wallet && hasData && (
    <p className="text-sm">
      <span dir="ltr" className={`inline-block font-semibold ${last >= 0 ? "text-success" : "text-danger"}`}>
        {money(last, { signed: true })}
        {periodPct != null ? ` (${formatPct(periodPct)})` : ""}
      </span>{" "}
      <span className="text-muted">{t(PERIOD_SUMMARY_KEY[PERIODS[periodIdx].labelKey])}</span>
    </p>
  );

  return (
    <div className="flex flex-col gap-3">
      {!wallet && periodBar}
      {summaryLine}

      {!hasData ? (
        wallet ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border/50 bg-background px-3 py-8">
            <div className="h-px w-full bg-accent/50" aria-hidden="true" />
            <p className="text-center text-xs text-muted">{t("walletChartEmpty")}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">{t("noEnoughClosedTrades")}</p>
        )
      ) : (
        <div className="rounded-lg border border-border bg-background p-3">
          {compare ? (
            <AreaLineChart
              points={compare.own}
              overlay={compare.line}
              timeAxis
              domain={[compare.start, compare.end]}
              format={(v) => formatPct(v)}
              axisFormat={(v) => formatPct(v, 1)}
              ariaLabel={t("benchmarkChartLabel")}
              fadeKey={`${periodIdx}-${bench}`}
            />
          ) : (
            <AreaLineChart
              points={points}
              format={(v) => money(v)}
              axisFormat={(v) => formatNumber(v, locale, Number.isInteger(v) ? 0 : 2)}
              ariaLabel={t("startingPoint", { amount: money(0) })}
            />
          )}
          <div className="flex items-center justify-between text-xs text-muted">
            {compare ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#8B95A7]" />
                  {bench === "BTCUSDT" ? t("benchmarkBtc") : t("benchmarkGold")}{" "}
                  <span dir="ltr">{formatPct(compare.refLast)}</span>
                </span>
                <span className={`font-semibold ${compare.ownLast >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                  {t("benchmarkYou")} {formatPct(compare.ownLast)}
                </span>
              </>
            ) : (
              <>
                <span>{t("startingPoint", { amount: money(0) })}</span>
                <span className={`font-semibold ${last >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                  {money(last, { signed: true })}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {wallet && periodBar}

      {hasData && canCompare && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("benchmarkLabel")}>
          <span className="text-xs text-muted">{t("benchmarkLabel")}</span>
          {benchOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={bench === o.key}
              onClick={() => chooseBench(o.key)}
              className={
                bench === o.key
                  ? "min-h-8 rounded-full border border-accent/50 bg-accent/15 px-3 text-xs font-medium text-foreground"
                  : "min-h-8 rounded-full border border-border px-3 text-xs text-muted transition hover:text-foreground"
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
