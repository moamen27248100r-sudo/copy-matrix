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

type ColorTier = "bad" | "medium" | "good";

const TIER_COLOR: Record<ColorTier, { text: string; stroke: string }> = {
  bad: { text: "text-rose-500", stroke: "stroke-rose-500" },
  medium: { text: "text-amber-400", stroke: "stroke-amber-500" },
  good: { text: "text-emerald-400", stroke: "stroke-emerald-500" },
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

// A single hairline vertical spine with a short horizontal tick into each
// of the 3 stacked rows -- exactly Exness's shape: one continuous line
// touching every node in the column, not a branching tree with a fork.
function Spine({ rows }: { rows: number }) {
  const total = rows * ROW_H + (rows - 1) * ROW_GAP;
  return (
    <div className="relative w-4 shrink-0" style={{ height: total }}>
      <div className="absolute inset-y-0 end-0 w-px bg-slate-700/50" />
      {Array.from({ length: rows }).map((_, i) => {
        const centerY = i * (ROW_H + ROW_GAP) + ROW_H / 2;
        return <div key={i} className="absolute end-0 h-px w-4 bg-slate-700/50" style={{ top: centerY }} />;
      })}
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
      <Ring value={value} size={32} tier={tier} />
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
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 text-emerald-400">
        <BoltIcon className="h-4 w-4" />
      </span>
      <span className="text-sm font-bold text-white">{label}</span>
    </Row>
  );
}

function SubNumber({ value, label }: { value: number; label: string }) {
  return (
    <Row>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-700 text-emerald-400">
        <CheckCircleIcon className="h-4 w-4" />
      </span>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-sm font-bold text-white" dir="ltr">{value}</span>
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
    <section className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-[#0b1222] p-4 sm:p-5">
      <h2 className="font-display text-base font-extrabold">{t("reliabilitySectionTitle")}</h2>

      <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
        {/* First in DOM = right column under RTL: the main reliability node. */}
        <div className="flex items-start gap-0">
          <Spine rows={3} />
          <div className="flex flex-col" style={{ gap: ROW_GAP }}>
            <MainRing value={reliabilityScore} status={reliabilityStatus} tier={mainTier} size={40} />
            <SubRing value={safetyScore} label={t("gaugeSafety")} />
            <SubRing value={riskExposureScore} label={t("gaugeRiskExposure")} inverted />
          </div>
        </div>

        {/* Second in DOM = left column under RTL: trading-activity node. */}
        <div className="flex items-start gap-0">
          <Spine rows={3} />
          <div className="flex flex-col" style={{ gap: ROW_GAP }}>
            <MainBadge label={t("importantBadgeLabel")} />
            <SubNumber value={limitScore} label={t("gaugeLimitScore")} />
            <SubNumber value={activeTradingDays} label={t("gaugeTradingDays")} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-800 pt-4">
        <h3 className="font-display text-sm font-extrabold">{t("equityChartTitle")}</h3>
        <TraderEquityChart signals={signals} />
      </div>
    </section>
  );
}
