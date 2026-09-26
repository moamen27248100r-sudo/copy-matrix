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

export function ExnessReliabilitySection({
  reliabilityScore,
  reliabilityStatus,
  safetyScore,
  safetyStatus,
  riskExposureScore,
  riskStatus,
  limitScore,
  activeTradingDays,
  signals,
}: {
  reliabilityScore: number;
  reliabilityStatus: string;
  safetyScore: number;
  safetyStatus: string;
  riskExposureScore: number;
  riskStatus: string;
  limitScore: number;
  activeTradingDays: number;
  signals: SignalRow[];
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

      <div className="flex flex-col gap-2.5 border-t border-slate-800 pt-4">
        <h3 className="font-display text-sm font-extrabold">{t("equityChartTitle")}</h3>
        <TraderEquityChart signals={signals} />
      </div>
    </section>
  );
}
