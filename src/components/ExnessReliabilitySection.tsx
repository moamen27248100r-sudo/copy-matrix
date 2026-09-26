"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { localeTag } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";
import { getGaugeTier, type GaugeTier } from "@/components/CircularGauge";
import type { ReliabilityPoint } from "@/lib/reliability";

type ColorTier = "bad" | "medium" | "good";

const TIER_COLOR: Record<ColorTier, { text: string; stroke: string; border: string }> = {
  bad: { text: "text-rose-500", stroke: "stroke-rose-500", border: "border-rose-500/30" },
  medium: { text: "text-amber-400", stroke: "stroke-amber-500", border: "border-amber-500/30" },
  good: { text: "text-emerald-400", stroke: "stroke-emerald-500", border: "border-emerald-500/30" },
};

// Risk reads inverted -- a low score is the good outcome -- so its color
// tier is flipped relative to reliability/safety/limit: raw "low" (risk
// under 25) must render as the GOOD/green color, not the "low value ->
// red" mapping that would be correct for the other, non-inverted gauges.
function colorTierFor(value: number, inverted: boolean): ColorTier {
  const raw: GaugeTier = getGaugeTier(value, inverted ? "risk" : "reliability");
  if (!inverted) return raw === "low" ? "bad" : raw === "medium" ? "medium" : "good";
  return raw === "low" ? "good" : raw === "medium" ? "medium" : "bad";
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// A clean, unfilled SVG ring -- no icon, no colored background card, just
// a thin track + a thin colored progress arc, with the plain percentage
// number set directly inside it in bright white/tier-colored text.
function Ring({
  value,
  size,
  strokeWidth,
  tier,
  showFraction,
}: {
  value: number;
  size: number;
  strokeWidth: number;
  tier: ColorTier;
  showFraction?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const offset = circumference * (1 - clamped / 100);
  const colors = TIER_COLOR[tier];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border)" strokeOpacity={0.4} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={colors.stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showFraction && (
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none" dir="ltr">
          <span className="text-[13px] font-bold text-white">{clamped}</span>
        </div>
      )}
    </div>
  );
}

// A single hairline stem down to a hairline horizontal bar connecting two
// children -- the thin right-angle "tree" connector, kept compact so the
// whole tree reads as one tight cluster instead of a tall spread.
function TreeConnector() {
  return (
    <div className="relative h-5 w-full">
      <div className="absolute start-1/2 top-0 h-2.5 w-px -translate-x-1/2 rtl:translate-x-1/2 bg-slate-700/60" />
      <div className="absolute start-1/4 top-2.5 end-1/4 h-px bg-slate-700/60" />
      <div className="absolute start-1/4 top-2.5 h-2.5 w-px bg-slate-700/60" />
      <div className="absolute end-1/4 top-2.5 h-2.5 w-px bg-slate-700/60" />
    </div>
  );
}

function SubRingNode({ value, label, inverted }: { value: number; label: string; inverted?: boolean }) {
  const tier = colorTierFor(value, !!inverted);
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <Ring value={value} size={48} strokeWidth={3} tier={tier} showFraction />
      <p className="text-center text-[11px] leading-tight text-slate-400">{label}</p>
    </div>
  );
}

function SubNumberNode({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 text-emerald-400">
        <CheckCircleIcon className="h-4 w-4" />
      </span>
      <p className="text-sm font-bold text-white" dir="ltr">{value}</p>
      <p className="text-center text-[11px] leading-tight text-slate-400">{label}</p>
    </div>
  );
}

const PERIODS: { labelKey: string; days: number | null }[] = [
  { labelKey: "periodMonth", days: 30 },
  { labelKey: "periodThreeMonths", days: 90 },
  { labelKey: "periodSixMonths", days: 180 },
  { labelKey: "periodYear", days: 365 },
  { labelKey: "periodAll", days: null },
];

function ReliabilityHistoryChart({ history }: { history: ReliabilityPoint[] }) {
  const t = useTranslations("TraderEquityChart");
  const tp = useTranslations("TradeHistory");
  const tprof = useTranslations("TraderProfile");
  const locale = useLocale() as Locale;
  const [periodIdx, setPeriodIdx] = useState(2);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    const period = PERIODS[periodIdx];
    const now = new Date();
    const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const cutoff = period.days != null ? todayUtcStart - period.days * 24 * 60 * 60 * 1000 : 0;
    return history.filter((p) => new Date(p.date).getTime() >= cutoff);
  }, [history, periodIdx]);

  const width = 600;
  const height = 160;
  const hasData = points.length >= 2;
  const stepX = hasData ? width / (points.length - 1) : 0;
  const yFor = (v: number) => height - (Math.max(0, Math.min(100, v)) / 100) * height;
  const coords = points.map((p, i) => `${i * stepX},${yFor(p.reliability)}`).join(" ");
  const areaPoints = hasData ? `0,${height} ${coords} ${width},${height}` : "";
  const last = points[points.length - 1];
  const lastTier: ColorTier = last ? colorTierFor(last.reliability, false) : "medium";
  const cssVar = lastTier === "bad" ? "--danger" : lastTier === "medium" ? "--warning" : "--success";
  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  const handlePointer = (clientX: number, svgEl: SVGSVGElement) => {
    if (!hasData) return;
    const rect = svgEl.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(relX / stepX)));
    setHoverIdx(idx);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="font-display text-sm font-extrabold">{tprof("reliabilityHistoryTitle")}</h3>
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p, i) => (
          <button
            key={p.labelKey}
            type="button"
            onClick={() => setPeriodIdx(i)}
            className={
              i === periodIdx
                ? "rounded border border-brand bg-brand/10 px-3 py-1 text-xs text-brand"
                : "rounded border border-slate-800 px-3 py-1 text-xs text-muted"
            }
          >
            {tp(p.labelKey)}
          </button>
        ))}
      </div>

      {!hasData ? (
        <p className="text-sm text-muted">{t("notEnoughData")}</p>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-[#0b1222] p-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-40 w-full touch-none"
            onMouseMove={(e) => handlePointer(e.clientX, e.currentTarget)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (touch) handlePointer(touch.clientX, e.currentTarget);
            }}
            onTouchEnd={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="reliability-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(${cssVar})`} stopOpacity="0.25" />
                <stop offset="100%" stopColor={`var(${cssVar})`} stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1={0} y1={yFor(70)} x2={width} y2={yFor(70)} stroke="var(--success)" strokeOpacity={0.35} strokeDasharray="4" />
            <line x1={0} y1={yFor(40)} x2={width} y2={yFor(40)} stroke="var(--warning)" strokeOpacity={0.35} strokeDasharray="4" />
            <polygon points={areaPoints} fill="url(#reliability-fill)" />
            <polyline
              fill="none"
              stroke={`var(${cssVar})`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={coords}
            />
            {hoverIdx != null && hovered && (
              <>
                <line x1={hoverIdx * stepX} y1={0} x2={hoverIdx * stepX} y2={height} stroke="var(--border)" strokeWidth={1} />
                <circle cx={hoverIdx * stepX} cy={yFor(hovered.reliability)} r={4} fill="var(--foreground)" stroke="var(--background)" strokeWidth={1.5} />
                {(() => {
                  const boxWidth = 108;
                  const boxHeight = 36;
                  const px = Math.min(Math.max(hoverIdx * stepX - boxWidth / 2, 2), width - boxWidth - 2);
                  const py = yFor(hovered.reliability) > height / 2 ? yFor(hovered.reliability) - boxHeight - 10 : yFor(hovered.reliability) + 10;
                  return (
                    <g pointerEvents="none">
                      <rect x={px} y={py} width={boxWidth} height={boxHeight} rx={6} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
                      <text x={px + boxWidth / 2} y={py + 15} textAnchor="middle" fontSize="10" fill="var(--muted)">
                        {new Date(hovered.date).toLocaleDateString(localeTag(locale), { day: "numeric", month: "short" })}
                      </text>
                      <text x={px + boxWidth / 2} y={py + 28} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)">
                        {hovered.reliability}/100
                      </text>
                    </g>
                  );
                })()}
              </>
            )}
          </svg>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{t("start")}: {points[0].reliability}/100</span>
            <span className="text-foreground">
              {t("current")}: {last?.reliability ?? 0}/100
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExnessReliabilitySection({
  reliabilityScore,
  reliabilityStatus,
  safetyScore,
  safetyStatus,
  riskExposureScore,
  riskStatus,
  limitScore,
  activeTradingDays,
  history,
}: {
  reliabilityScore: number;
  reliabilityStatus: string;
  safetyScore: number;
  safetyStatus: string;
  riskExposureScore: number;
  riskStatus: string;
  limitScore: number;
  activeTradingDays: number;
  history: ReliabilityPoint[];
}) {
  const t = useTranslations("TraderProfile");
  const mainTier = colorTierFor(reliabilityScore, false);
  const mainColors = TIER_COLOR[mainTier];

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-[#0b1222] p-4 sm:p-5">
      <h2 className="font-display text-base font-extrabold">{t("reliabilitySectionTitle")}</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* First in DOM = right column under RTL: the main reliability node. */}
        <div className="flex flex-col items-center">
          <div className="flex w-full items-center justify-center gap-3">
            <Ring value={reliabilityScore} size={64} strokeWidth={4} tier={mainTier} />
            <div className="flex flex-col items-start gap-0.5">
              <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${mainColors.border} ${mainColors.text}`}>
                {reliabilityStatus}
              </span>
              <p className={`text-xl font-extrabold ${mainColors.text}`} dir="ltr">
                {Math.max(0, Math.min(100, Math.round(reliabilityScore)))}/100
              </p>
            </div>
          </div>
          <TreeConnector />
          <div className="flex w-full items-start justify-center gap-6">
            <SubRingNode value={safetyScore} label={t("gaugeSafety")} />
            <SubRingNode value={riskExposureScore} label={t("gaugeRiskExposure")} inverted />
          </div>
        </div>

        {/* Second in DOM = left column under RTL: trading-activity node. */}
        <div className="flex flex-col items-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-emerald-400">
            <BoltIcon className="h-4 w-4" />
          </span>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">{t("importantBadgeLabel")}</p>
          <TreeConnector />
          <div className="flex w-full items-start justify-center gap-6">
            <SubNumberNode value={limitScore} label={t("gaugeLimitScore")} />
            <SubNumberNode value={activeTradingDays} label={t("gaugeTradingDays")} />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4">
        <ReliabilityHistoryChart history={history} />
      </div>
    </section>
  );
}
