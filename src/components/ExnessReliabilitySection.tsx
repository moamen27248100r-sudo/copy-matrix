"use client";

import { useTranslations } from "next-intl";
import { getGaugeTier, type GaugeTier } from "@/components/CircularGauge";
import { TraderEquityChart } from "@/components/TraderEquityChart";

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

type ColorTier = "bad" | "medium" | "good" | "neutral";

const TIER_COLOR: Record<ColorTier, { text: string; stroke: string }> = {
  bad: { text: "text-rose-500", stroke: "stroke-rose-500" },
  medium: { text: "text-amber-400", stroke: "stroke-amber-500" },
  good: { text: "text-emerald-400", stroke: "stroke-emerald-500" },
  // The activity column (limit score / trading days) isn't a good/bad
  // judgment, just a count -- muted slate instead of a traffic-light color.
  neutral: { text: "text-slate-500", stroke: "stroke-slate-500" },
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

// A minimalist, unfilled SVG ring -- a hairline track + hairline colored
// progress arc, nothing else (no icon, no fill card behind it).
function Ring({ value, size, tier }: { value: number; size: number; tier: ColorTier }) {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const offset = circumference * (1 - clamped / 100);
  const colors = TIER_COLOR[tier];

  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
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
  );
}

const ROW_H = 40;
const ROW_GAP = 14;

// A bracket connector, not a straight spine: a short stub exits the main
// node, then a vertical arc forks down to the top and bottom sub-nodes
// only -- the main node's own tick sits one step further out than the
// two sub-ticks, so the shape reads as a fork instead of one flat line
// with three evenly-spaced ticks on it.
function BracketConnector() {
  const mainCenter = ROW_H / 2;
  const sub1Center = ROW_H + ROW_GAP + ROW_H / 2;
  const sub2Center = 2 * (ROW_H + ROW_GAP) + ROW_H / 2;
  const total = 3 * ROW_H + 2 * ROW_GAP;
  const stubW = 8;
  const innerInset = 8;

  return (
    <div className="relative w-5 shrink-0" style={{ height: total }}>
      {/* stub from the main node, at the outer edge */}
      <div className="absolute h-px bg-slate-700/50" style={{ insetInlineEnd: 0, width: stubW, top: mainCenter }} />
      {/* the fork: vertical arc from the main node's height down to the
          bottom sub-node, offset inward from the main stub */}
      <div
        className="absolute w-px bg-slate-700/50"
        style={{ insetInlineEnd: innerInset, top: mainCenter, height: sub2Center - mainCenter }}
      />
      {/* ticks into each sub-node */}
      <div className="absolute h-px bg-slate-700/50" style={{ insetInlineEnd: 0, width: innerInset, top: sub1Center }} />
      <div className="absolute h-px bg-slate-700/50" style={{ insetInlineEnd: 0, width: innerInset, top: sub2Center }} />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5" style={{ height: ROW_H }}>
      {children}
    </div>
  );
}

function MainRing({ value, status, tier, size }: { value: number; status: string; tier: ColorTier; size: number }) {
  const colors = TIER_COLOR[tier];
  return (
    <Row>
      <Ring value={value} size={size} tier={tier} />
      <div className="flex flex-col items-start leading-tight">
        <span className={`text-[11px] font-semibold ${colors.text}`}>{status}</span>
        <span className={`text-base font-extrabold ${colors.text}`} dir="ltr">
          {Math.max(0, Math.min(100, Math.round(value)))}/100
        </span>
      </div>
    </Row>
  );
}

function SubRing({ value, label, inverted }: { value: number; label: string; inverted?: boolean }) {
  const tier = colorTierFor(value, !!inverted);
  const colors = TIER_COLOR[tier];
  return (
    <Row>
      <Ring value={value} size={24} tier={tier} />
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className={`text-sm font-bold ${colors.text}`} dir="ltr">
          {Math.max(0, Math.min(100, Math.round(value)))}/100
        </span>
      </div>
    </Row>
  );
}

function MainBadge({ label }: { label: string }) {
  return (
    <Row>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-emerald-400">
        <BoltIcon className="h-4 w-4" />
      </span>
      <span className="text-sm font-bold text-white">{label}</span>
    </Row>
  );
}

// Not a score against 0-100 in the same sense as the reliability column
// -- a plain muted-slate ring, no checkmark icon, matching the reference
// design's cleaner "ring only" look for this side.
function SubNumber({ value, label }: { value: number; label: string }) {
  return (
    <Row>
      <Ring value={value} size={24} tier="neutral" />
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-sm font-bold text-slate-500" dir="ltr">{value}</span>
      </div>
    </Row>
  );
}

export function ExnessReliabilitySection({
  reliabilityScore,
  reliabilityStatus,
  safetyScore,
  riskExposureScore,
  limitScore,
  activeTradingDays,
  signals,
}: {
  reliabilityScore: number;
  reliabilityStatus: string;
  safetyScore: number;
  riskExposureScore: number;
  limitScore: number;
  activeTradingDays: number;
  signals: SignalRow[];
}) {
  const t = useTranslations("TraderProfile");
  const mainTier = colorTierFor(reliabilityScore, false);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-base font-extrabold">{t("reliabilitySectionTitle")}</h2>

      <div className="grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-6">
        {/* First in DOM = right column under RTL: the main reliability node. */}
        <div className="flex items-start gap-0">
          <BracketConnector />
          <div className="flex min-w-0 flex-col" style={{ gap: ROW_GAP }}>
            <MainRing value={reliabilityScore} status={reliabilityStatus} tier={mainTier} size={28} />
            <SubRing value={safetyScore} label={t("gaugeSafety")} />
            <SubRing value={riskExposureScore} label={t("gaugeRiskExposure")} inverted />
          </div>
        </div>

        {/* Second in DOM = left column under RTL: trading-activity node. */}
        <div className="flex items-start gap-0">
          <BracketConnector />
          <div className="flex min-w-0 flex-col" style={{ gap: ROW_GAP }}>
            <MainBadge label={t("importantBadgeLabel")} />
            <SubNumber value={limitScore} label={t("gaugeLimitScore")} />
            <SubNumber value={activeTradingDays} label={t("gaugeTradingDays")} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-800/40 pt-4">
        <h3 className="font-display text-sm font-extrabold">{t("equityChartTitle")}</h3>
        <TraderEquityChart signals={signals} />
      </div>
    </div>
  );
}
