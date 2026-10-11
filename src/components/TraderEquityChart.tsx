"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AreaLineChart, type ChartPoint } from "@/components/charts/AreaLineChart";
import { localeTag } from "@/lib/locale-format";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { Locale } from "@/i18n/locales";

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

type ChartData = { points: ChartPoint[]; domain: [number, number] };

// The interactive chart: period buttons, a header that shows the current value
// (or the point under the cursor) with the period name or the point's date
// under it, the chart, and the Start / Current line. Rendered inline and again inside the
// full-screen overlay.
function EquityPanel({
  data,
  periodIdx,
  onPeriod,
  height,
  action,
}: {
  data: ChartData;
  periodIdx: number;
  onPeriod: (i: number) => void;
  height: number;
  action: React.ReactNode;
}) {
  const t = useTranslations("TraderEquityChart");
  const tp = useTranslations("TradeHistory");
  const tr = useTranslations("Trades");
  const locale = useLocale() as Locale;
  const tag = localeTag(locale);
  const { points, domain } = data;
  const [hover, setHover] = useState<{ idx: number; src: ChartPoint[] } | null>(null);
  const hoverIdx = hover && hover.src === points ? hover.idx : null;

  const n = points.length;
  const last = points[n - 1].v;
  const idx = hoverIdx != null && hoverIdx < n ? hoverIdx : n - 1;
  const shown = points[idx];
  const gain = shown.v >= 0;
  const periodDays = PERIODS[periodIdx].days;
  // "Last 30 days" ... or "All" for the whole history.
  const periodLabel = periodDays != null ? tr("lastDays", { days: periodDays }) : tp(PERIODS[periodIdx].labelKey);
  const dateLine =
    hoverIdx != null && shown.t != null
      ? new Date(shown.t).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
      : periodLabel;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group">
        {PERIODS.map((p, i) => (
          <button
            key={p.labelKey}
            type="button"
            aria-pressed={i === periodIdx}
            onClick={() => {
              setHover(null);
              onPeriod(i);
            }}
            className={`min-h-8 rounded-full px-3.5 py-1 text-xs transition-colors duration-200 motion-reduce:transition-none ${
              i === periodIdx ? "bg-brand/25 text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {tp(p.labelKey)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border/50 bg-background p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0" aria-live="polite">
            <span
              className={`flex items-baseline gap-1.5 text-[28px] font-bold leading-tight tabular-nums ${gain ? "text-success" : "text-danger"}`}
              dir="ltr"
            >
              <span className="text-sm" aria-hidden="true">
                {gain ? "▲" : "▼"}
              </span>
              {fmtPct(shown.v)}
            </span>
            <p className="text-xs text-muted" dir="auto">
              {dateLine}
            </p>
          </div>
          {action}
        </div>

        <AreaLineChart
          points={points}
          format={fmtPct}
          ariaLabel={t("performanceAria", { period: periodLabel, value: fmtPct(last) })}
          timeAxis
          domain={domain}
          height={height}
          mode="interactive"
          fadeKey={periodIdx}
          onHover={(i) => setHover(i == null ? null : { idx: i, src: points })}
        />

        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>
            {t("start")}: <bdi dir="ltr">0%</bdi>
          </span>
          <span>
            {t("current")}:{" "}
            <bdi dir="ltr" className={`font-semibold ${last < 0 ? "text-danger" : "text-foreground"}`}>
              {fmtPct(last)}
            </bdi>
          </span>
        </div>
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const ICON_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none";

export function TraderEquityChart({ daily }: { daily: DailySeries | null }) {
  const t = useTranslations("TraderEquityChart");
  const [periodIdx, setPeriodIdx] = useState(1);
  const [full, setFull] = useState(false);
  const [viewportH, setViewportH] = useState(0);

  const data = useMemo<ChartData>(() => {
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
    return { points: pts, domain: [start, end] };
  }, [daily, periodIdx]);

  // Full screen: its own history entry, so the phone's Back button closes it;
  // Esc closes it too.
  const openFull = useCallback(() => {
    window.history.pushState({ equityChartFull: true }, "");
    setFull(true);
  }, []);
  const closeFull = useCallback(() => {
    if (window.history.state?.equityChartFull) window.history.back();
    else setFull(false);
  }, []);

  useEffect(() => {
    if (!full) return;
    const onPop = () => setFull(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFull();
      }
    };
    const onResize = () => setViewportH(window.innerHeight);
    onResize();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [full, closeFull]);

  useBodyScrollLock(full);

  const expandButton = (
    <button type="button" onClick={openFull} aria-label={t("expand")} title={t("expand")} className={ICON_BUTTON}>
      <ExpandIcon />
    </button>
  );

  return (
    <>
      <EquityPanel data={data} periodIdx={periodIdx} onPeriod={setPeriodIdx} height={180} action={expandButton} />

      {full && (
        <div role="dialog" aria-modal="true" aria-label={t("performanceTitle")} className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background p-4">
          <div className="mx-auto w-full max-w-5xl">
            <EquityPanel
              data={data}
              periodIdx={periodIdx}
              onPeriod={setPeriodIdx}
              height={Math.max(240, viewportH - 250)}
              action={
                <button type="button" onClick={closeFull} aria-label={t("closeFullscreen")} title={t("closeFullscreen")} className={ICON_BUTTON} autoFocus>
                  <CloseIcon />
                </button>
              }
            />
          </div>
        </div>
      )}
    </>
  );
}
