"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { localeTag } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

// The platform's one line/area chart: a quiet blue line over a fading fill,
// right-hand value axis, dashed current-value line with a white badge --
// the look of a market-data app. Every line chart in the app renders through
// this component; callers only supply points and a value formatter.

export type ChartPoint = {
  v: number;
  // Epoch ms (UTC). Optional: without it the chart has no dates, only values.
  t?: number;
};

const LINE = "#5B8DEF";
const GRID = "rgba(255,255,255,0.06)";
const AXIS_TEXT = "#8B95A7";
const LAST_LINE = "rgba(184,192,204,0.65)";
const FONT = 11;
const PAD_TOP = 8;
const X_AXIS_H = 20;
const BADGE_H = 18;

function niceTicks(lo: number, hi: number, target: number): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / Math.max(target - 1, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

export function AreaLineChart({
  points,
  format,
  axisFormat,
  ariaLabel,
  compact = false,
  timeAxis = false,
  domain,
  height,
  className = "",
}: {
  points: ChartPoint[];
  // Used for the axis, the current-value badge and the tooltip.
  format: (v: number) => string;
  // Shorter form for the axis ticks only (e.g. no currency suffix).
  axisFormat?: (v: number) => string;
  ariaLabel: string;
  // Hides the two axes only; everything else stays.
  compact?: boolean;
  // Place points by their time (needs `t`) instead of evenly by index.
  timeAxis?: boolean;
  // [startMs, endMs] for the time axis; defaults to the first/last point.
  domain?: [number, number];
  height?: number;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  const tag = localeTag(locale);
  const gradId = `alc-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Tied to the points array it was picked from, so a data change (e.g. a new
  // period) never leaves a tooltip pointing at a stale index.
  const [hover, setHover] = useState<{ idx: number; src: ChartPoint[] } | null>(null);
  const hoverIdx = hover && hover.src === points ? hover.idx : null;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = height ?? (compact ? 56 : 180);
  const n = points.length;
  const last = n > 0 ? points[n - 1].v : 0;

  const model = useMemo(() => {
    if (n < 2) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      if (p.v < lo) lo = p.v;
      if (p.v > hi) hi = p.v;
    }
    const span = hi - lo || Math.max(Math.abs(hi), 1) * 0.1;
    const yMin = lo - span * 0.08;
    const yMax = hi + span * 0.08;
    const ticks = niceTicks(yMin, yMax, compact ? 3 : 5);
    const d0 = domain?.[0] ?? points[0].t ?? 0;
    const d1 = domain?.[1] ?? points[n - 1].t ?? 1;
    return { yMin, yMax, ticks, d0, d1 };
  }, [points, n, compact, domain]);

  if (!model) return <div className={className} style={{ height: H }} aria-hidden="true" />;
  const { yMin, yMax, ticks, d0, d1 } = model;

  // A window of under three days labels hours instead of days, so ticks
  // never repeat the same date.
  const fmtDay = (t: number, full: boolean) =>
    shortSpan
      ? new Date(t).toLocaleString(tag, {
          ...(full ? { day: "2-digit", month: "short" } : {}),
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : new Date(t).toLocaleDateString(tag, { day: full ? "numeric" : "2-digit", month: "short", ...(full ? { year: "numeric" } : {}), timeZone: "UTC" });

  const fmtAxis = axisFormat ?? format;
  const lastLabel = format(last);
  const labelChars = compact ? lastLabel.length : Math.max(lastLabel.length, ...ticks.map((v) => fmtAxis(v).length));
  const gutter = Math.ceil(labelChars * 6.8 + 14);
  const plotW = Math.max(width - gutter, 1);
  const plotBottom = H - (compact ? PAD_TOP : X_AXIS_H);
  const plotH = Math.max(plotBottom - PAD_TOP, 1);
  const yFor = (v: number) => PAD_TOP + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const useTime = timeAxis && points[0].t != null;
  const xFor = (i: number) => {
    if (useTime) return ((points[i].t! - d0) / (d1 - d0 || 1)) * plotW;
    return (i / (n - 1)) * plotW;
  };

  const coords = points.map((p, i): [number, number] => [xFor(i), yFor(p.v)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[n - 1][0].toFixed(1)} ${plotBottom} L${coords[0][0].toFixed(1)} ${plotBottom}Z`;
  const lastY = yFor(last);
  const badgeY = Math.min(Math.max(lastY - BADGE_H / 2, 0), H - BADGE_H);

  // X-axis dates: a few evenly spaced positions so they never crowd.
  const spanDays = useTime || points[0].t != null ? ((useTime ? d1 - d0 : (points[n - 1].t ?? 0) - (points[0].t ?? 0)) / 86400000) : 0;
  const withYear = spanDays > 330;
  const shortSpan = spanDays > 0 && spanDays < 3;
  const xCount = Math.min(5, Math.max(2, Math.floor(plotW / 96)));
  const xLabels: { x: number; text: string; anchor: "start" | "middle" | "end" }[] = [];
  if (!compact) {
    for (let k = 0; k < xCount; k++) {
      const f = k / (xCount - 1);
      let t: number | undefined;
      if (useTime) t = d0 + f * (d1 - d0);
      else t = points[Math.round(f * (n - 1))].t;
      if (t == null) continue;
      xLabels.push({ x: f * plotW, text: fmtDay(t, withYear), anchor: k === 0 ? "start" : k === xCount - 1 ? "end" : "middle" });
    }
  }

  const hovered = hoverIdx != null && hoverIdx < n ? points[hoverIdx] : null;
  const handlePointer = (clientX: number, el: HTMLElement) => {
    const x = clientX - el.getBoundingClientRect().left;
    let best = 0;
    let bestDist = Infinity;
    coords.forEach(([cx], i) => {
      const d = Math.abs(cx - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHover({ idx: best, src: points });
  };

  const tipW = hovered?.t != null ? 124 : 92;
  const hx = hovered ? coords[hoverIdx!][0] : 0;
  const hy = hovered ? coords[hoverIdx!][1] : 0;
  const tipLeft = Math.min(Math.max(hx - tipW / 2, 2), Math.max(width - tipW - 2, 2));
  const tipTop = hy > H / 2 ? Math.max(hy - 52, 0) : hy + 12;

  return (
    <div
      ref={boxRef}
      dir="ltr"
      className={`relative w-full touch-pan-y select-none ${className}`}
      style={{ height: H }}
      onPointerMove={(e) => handlePointer(e.clientX, e.currentTarget)}
      onPointerDown={(e) => handlePointer(e.clientX, e.currentTarget)}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHover(null);
      }}
    >
      {width > 0 && (
        <svg
          width={width}
          height={H}
          {...(ariaLabel ? { role: "img", "aria-label": `${ariaLabel}: ${lastLabel}` } : { "aria-hidden": true })}
          className="block"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={LINE} stopOpacity="0.45" />
              <stop offset="1" stopColor={LINE} stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((v) => (
            <line key={v} x1={0} x2={plotW} y1={yFor(v)} y2={yFor(v)} stroke={GRID} strokeWidth={1} />
          ))}

          <path d={areaPath} fill={`url(#${gradId})`} />
          <path d={linePath} fill="none" stroke={LINE} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

          {!compact &&
            ticks.map((v) => {
              const y = yFor(v);
              if (Math.abs(y - lastY) < BADGE_H * 0.8) return null;
              return (
                <text key={v} x={plotW + 8} y={y + FONT * 0.35} fill={AXIS_TEXT} fontSize={FONT}>
                  {fmtAxis(v)}
                </text>
              );
            })}
          {xLabels.map((l, i) => (
            <text key={i} x={l.x} y={H - 5} textAnchor={l.anchor} fill={AXIS_TEXT} fontSize={FONT}>
              {l.text}
            </text>
          ))}

          <line x1={0} x2={plotW + 4} y1={lastY} y2={lastY} stroke={LAST_LINE} strokeWidth={1} strokeDasharray="4 4" />
          <rect x={plotW + 4} y={badgeY} width={Math.max(gutter - 4, 1)} height={BADGE_H} rx={3} fill="#ffffff" />
          <text
            x={plotW + 4 + Math.max(gutter - 4, 1) / 2}
            y={badgeY + BADGE_H / 2 + FONT * 0.36}
            textAnchor="middle"
            fill="#000000"
            fontSize={FONT}
            fontWeight={700}
          >
            {lastLabel}
          </text>

          {hovered && (
            <g pointerEvents="none">
              <line x1={hx} x2={hx} y1={PAD_TOP} y2={plotBottom} stroke="#8B95A7" strokeOpacity={0.7} strokeWidth={1} />
              <circle cx={hx} cy={hy} r={3.5} fill={LINE} stroke="#0b0f17" strokeWidth={1.5} />
            </g>
          )}
        </svg>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-background px-2.5 py-1.5 text-center shadow-lg shadow-black/40"
          style={{ left: tipLeft, top: tipTop, width: tipW }}
        >
          {hovered.t != null && (
            <p className="text-[11px]" style={{ color: AXIS_TEXT }}>
              {fmtDay(hovered.t, true)}
            </p>
          )}
          <p className="text-sm font-semibold text-foreground">{format(hovered.v)}</p>
        </div>
      )}
    </div>
  );
}
