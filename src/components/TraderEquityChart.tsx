"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { localeTag } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

type SignalRow = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

const PERIODS: { labelKey: string; days: number | null }[] = [
  { labelKey: "periodWeek", days: 7 },
  { labelKey: "periodMonth", days: 30 },
  { labelKey: "periodThreeMonths", days: 90 },
  { labelKey: "periodYear", days: 365 },
  { labelKey: "periodAll", days: null },
];

const DAY = 24 * 60 * 60 * 1000;
const CHART_H = 200;
const PAD = { top: 12, right: 46, bottom: 24, left: 8 };
const BRAND = "#2f6fed";
const DOWN = "#f6465d";

type ChartPoint = { value: number; time: number | null };

function niceStep(rawStep: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const n = rawStep / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function fmtPct(v: number, digits = 2) {
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function TraderEquityChart({ signals }: { signals: SignalRow[] }) {
  const t = useTranslations("TraderEquityChart");
  const tp = useTranslations("TradeHistory");
  const locale = useLocale() as Locale;
  const tag = localeTag(locale);
  const gradId = useId().replace(/:/g, "");
  const [periodIdx, setPeriodIdx] = useState(1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const cutoff = period.days != null ? todayUtcStart - period.days * DAY : 0;
    const closed = signals
      .filter(
        (s) =>
          s.status === "closed" &&
          s.closed_at &&
          s.exit_price != null &&
          new Date(s.closed_at).getTime() >= cutoff,
      )
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

    let cumulative = 0;
    const pts: ChartPoint[] = [{ value: 0, time: null }];
    for (const s of closed) {
      const raw = (s.exit_price! - s.entry_price) / s.entry_price;
      const signed = s.side === "sell" ? -raw : raw;
      cumulative += signed * 100;
      pts.push({ value: cumulative, time: new Date(s.closed_at!).getTime() });
    }

    // Time axis: fixed window for a bounded period; for "all", from the
    // first closed trade. The start point sits at the window start.
    const end = todayUtcStart + DAY;
    const firstTrade = pts.length > 1 ? (pts[1].time as number) : end - 30 * DAY;
    const start = period.days != null ? cutoff : Math.min(firstTrade - DAY, end - DAY);
    pts[0].time = start;
    // A period with no closed trades still gets a flat line across the window.
    if (pts.length < 2) pts.push({ value: 0, time: end });
    return { points: pts, startT: start, endT: end };
  }, [signals, periodIdx]);

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 0);
  const span = rawMax - rawMin || 1;
  const step = niceStep(span / 3);
  const yMin = Math.floor((rawMin - span * 0.08) / step) * step;
  const yMax = Math.ceil((rawMax + span * 0.08) / step) * step;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(Number(v.toFixed(6)));

  const xFor = (time: number) => PAD.left + ((time - startT) / (endT - startT || 1)) * plotW;
  const yFor = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const last = values[values.length - 1] ?? 0;
  const negative = last < 0;
  const color = negative ? DOWN : BRAND;

  // Step the line to "now" so the curve visibly extends across the window.
  const linePts = points.map((p) => [xFor(p.time as number), yFor(p.value)] as const);
  const lastPt = linePts[linePts.length - 1];
  const extended = lastPt[0] < PAD.left + plotW ? [...linePts, [PAD.left + plotW, lastPt[1]] as const] : linePts;
  const linePath = extended.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const baseY = yFor(Math.max(yMin, Math.min(0, yMax)));
  const areaPath = `${linePath} L${extended[extended.length - 1][0].toFixed(1)},${baseY.toFixed(1)} L${extended[0][0].toFixed(1)},${baseY.toFixed(1)} Z`;

  const longRange = PERIODS[periodIdx].days == null || (PERIODS[periodIdx].days ?? 0) > 120;
  const xTickCount = width < 420 ? 3 : 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => startT + ((endT - startT) * i) / (xTickCount - 1));
  const fmtAxisDate = (ms: number) =>
    new Date(ms).toLocaleDateString(tag, longRange ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });

  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  const handlePointer = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    linePts.forEach(([px], i) => {
      const d = Math.abs(px - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  const tipW = 116;
  const hx = hovered ? xFor(hovered.time as number) : 0;
  const hy = hovered ? yFor(hovered.value) : 0;
  const tipLeft = Math.min(Math.max(hx - tipW / 2, 2), Math.max(width - tipW - 2, 2));
  const tipTop = hy > CHART_H / 2 ? hy - 54 : hy + 14;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group">
        {PERIODS.map((p, i) => (
          <button
            key={p.labelKey}
            type="button"
            aria-pressed={i === periodIdx}
            onClick={() => {
              setPeriodIdx(i);
              setHoverIdx(null);
            }}
            className={`min-h-8 rounded-md border px-3 py-1 text-xs transition-colors duration-200 motion-reduce:transition-none ${
              i === periodIdx ? "border-brand bg-brand/15 text-brand" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {tp(p.labelKey)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border/50 bg-surface/40 p-2 sm:p-3">
        <div
          ref={boxRef}
          dir="ltr"
          className="relative w-full touch-pan-y select-none"
          style={{ height: CHART_H }}
          onPointerMove={(e) => handlePointer(e.clientX, e.currentTarget)}
          onPointerDown={(e) => handlePointer(e.clientX, e.currentTarget)}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setHoverIdx(null);
          }}
        >
          {width > 0 && (
            <svg
              width={width}
              height={CHART_H}
              role="img"
              aria-label={`${t("current")}: ${fmtPct(last)}`}
              className="block"
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>

              {yTicks.map((v) => (
                <g key={v}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + plotW}
                    y1={yFor(v)}
                    y2={yFor(v)}
                    stroke="var(--border)"
                    strokeOpacity={v === 0 ? 0.9 : 0.35}
                    strokeDasharray={v === 0 ? "4 4" : undefined}
                    strokeWidth={1}
                  />
                  <text x={PAD.left + plotW + 6} y={yFor(v) + 3.5} fontSize="10" fill="var(--muted)">
                    {Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(step < 1 ? 1 : 0)}%
                  </text>
                </g>
              ))}

              {xTicks.map((ms, i) => (
                <text
                  key={i}
                  x={xFor(ms)}
                  y={CHART_H - 6}
                  fontSize="10"
                  fill="var(--muted)"
                  textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
                >
                  {fmtAxisDate(ms)}
                </text>
              ))}

              {/* keyed by period so the curve re-draws with a soft reveal on filter change */}
              <g key={`${periodIdx}-${width}`} className="equity-chart-reveal">
                <path d={areaPath} fill={`url(#${gradId})`} />
                <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </g>

              {hovered && (
                <g pointerEvents="none">
                  <line x1={hx} x2={hx} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted)" strokeOpacity={0.6} strokeDasharray="3 3" />
                  <line x1={PAD.left} x2={PAD.left + plotW} y1={hy} y2={hy} stroke="var(--muted)" strokeOpacity={0.35} strokeDasharray="3 3" />
                  <circle cx={hx} cy={hy} r={5} fill={color} stroke="var(--background)" strokeWidth={2} />
                </g>
              )}
            </svg>
          )}

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-border bg-background px-2.5 py-1.5 text-center shadow-lg shadow-black/40"
              style={{ left: tipLeft, top: tipTop, width: tipW }}
            >
              <p className="text-[10px] text-muted">
                {hoverIdx === 0
                  ? t("start")
                  : new Date(hovered.time as number).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className={`text-sm font-semibold ${hovered.value < 0 ? "text-danger" : "text-foreground"}`}>{fmtPct(hovered.value)}</p>
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>{t("start")}: 0%</span>
          <span className={negative ? "text-danger" : "text-foreground"}>
            {t("current")}: <bdi dir="ltr">{fmtPct(last)}</bdi>
          </span>
        </div>
      </div>
    </div>
  );
}
