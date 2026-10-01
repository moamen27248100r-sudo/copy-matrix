"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const CHART_H = 180;
const PAD_Y = 12;
const SAMPLES = 96;
const MORPH_MS = 450;
const COLOR = "var(--brand)";

type ChartPoint = { value: number; time: number };

function fmtPct(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// Samples the cumulative curve at SAMPLES evenly spaced times so two different
// periods can be morphed into each other value by value.
function resample(points: ChartPoint[], startT: number, endT: number): number[] {
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = startT + ((endT - startT) * i) / (SAMPLES - 1);
    while (j < points.length - 2 && points[j + 1].time <= t) j++;
    const a = points[j];
    const b = points[Math.min(j + 1, points.length - 1)];
    if (t <= a.time || b.time === a.time) out.push(t >= b.time ? b.value : a.value);
    else if (t >= b.time) out.push(b.value);
    else out.push(a.value + ((b.value - a.value) * (t - a.time)) / (b.time - a.time));
  }
  return out;
}

export function TraderEquityChart({ signals }: { signals: SignalRow[] }) {
  const t = useTranslations("TraderEquityChart");
  const tp = useTranslations("TradeHistory");
  const locale = useLocale() as Locale;
  const tag = localeTag(locale);
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

    const end = todayUtcStart + DAY;
    const firstTrade = closed.length > 0 ? new Date(closed[0].closed_at!).getTime() : end - 30 * DAY;
    const start = period.days != null ? cutoff : Math.min(firstTrade - DAY, end - DAY);

    let cumulative = 0;
    const pts: ChartPoint[] = [{ value: 0, time: start }];
    for (const s of closed) {
      const raw = (s.exit_price! - s.entry_price) / s.entry_price;
      const signed = s.side === "sell" ? -raw : raw;
      cumulative += signed * 100;
      pts.push({ value: cumulative, time: new Date(s.closed_at!).getTime() });
    }
    // A period with no closed trades still gets a flat line across the window.
    if (pts.length < 2) pts.push({ value: 0, time: end });
    return { points: pts, startT: start, endT: end };
  }, [signals, periodIdx]);

  const target = useMemo(() => resample(points, startT, endT), [points, startT, endT]);

  // Morph the drawn curve toward the new period's curve instead of snapping.
  const [display, setDisplay] = useState<number[]>(target);
  const displayRef = useRef<number[]>(target);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    const from = displayRef.current;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const set = (v: number[]) => {
      displayRef.current = v;
      setDisplay(v);
    };
    if (reduce) {
      raf = requestAnimationFrame(() => set(target));
      return () => cancelAnimationFrame(raf);
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / MORPH_MS, 1);
      const e = 1 - Math.pow(1 - p, 3);
      set(target.map((v, i) => from[i] + (v - from[i]) * e));
      if (p < 1) raf = requestAnimationFrame(step);
      else setAnimating(false);
    };
    raf = requestAnimationFrame((now) => {
      setAnimating(true);
      step(now);
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const plotW = Math.max(width, 1);
  const plotH = CHART_H - PAD_Y * 2;
  const rawMin = Math.min(...display, 0);
  const rawMax = Math.max(...display, 0);
  const span = rawMax - rawMin || 1;
  const yMin = rawMin - span * 0.1;
  const yMax = rawMax + span * 0.1;
  const yFor = (v: number) => PAD_Y + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const xForTime = (time: number) => ((time - startT) / (endT - startT || 1)) * plotW;

  const last = points[points.length - 1].value;
  const negative = last < 0;
  const linePath = display
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (SAMPLES - 1)) * plotW).toFixed(1)},${yFor(v).toFixed(1)}`)
    .join(" ");
  const zeroY = yFor(0);

  const hovered = hoverIdx != null && !animating ? points[hoverIdx] : null;

  const handlePointer = (clientX: number, el: HTMLElement) => {
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xForTime(p.time) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  const tipW = 116;
  const hx = hovered ? xForTime(hovered.time) : 0;
  const hy = hovered ? yFor(hovered.value) : 0;
  const tipLeft = Math.min(Math.max(hx - tipW / 2, 2), Math.max(width - tipW - 2, 2));
  const tipTop = hy > CHART_H / 2 ? hy - 56 : hy + 14;

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

      <div className="rounded-lg border border-border/50 p-3">
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
            <svg width={width} height={CHART_H} role="img" aria-label={`${t("current")}: ${fmtPct(last)}`} className="block">
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1={0} x2={plotW} y1={CHART_H * f} y2={CHART_H * f} stroke="var(--border)" strokeWidth={0.5} />
              ))}
              <line x1={0} x2={plotW} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeDasharray="4" />
              <path d={linePath} fill="none" stroke={COLOR} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

              {hovered && (
                <g pointerEvents="none">
                  <line x1={hx} x2={hx} y1={0} y2={CHART_H} stroke="var(--muted)" strokeOpacity={0.6} strokeDasharray="3 3" />
                  <line x1={0} x2={plotW} y1={hy} y2={hy} stroke="var(--muted)" strokeOpacity={0.35} strokeDasharray="3 3" />
                  <circle cx={hx} cy={hy} r={4.5} fill={COLOR} stroke="var(--background)" strokeWidth={2} />
                </g>
              )}
            </svg>
          )}

          {hovered && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-border bg-background px-2.5 py-1.5 text-center shadow-lg shadow-black/40"
              style={{ left: tipLeft, top: tipTop, width: tipW }}
            >
              <p className="text-[11px] text-muted" dir="auto">
                {hoverIdx === 0
                  ? t("start")
                  : new Date(hovered.time).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
              </p>
              <p className={`text-sm font-semibold ${hovered.value < 0 ? "text-danger" : "text-foreground"}`}>{fmtPct(hovered.value)}</p>
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>
            {t("start")}: <bdi dir="ltr">0%</bdi>
          </span>
          <span className={negative ? "text-danger" : "text-foreground"}>
            {t("current")}: <bdi dir="ltr">{fmtPct(last)}</bdi>
          </span>
        </div>
      </div>
    </div>
  );
}
