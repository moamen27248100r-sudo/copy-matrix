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

const TIER_COLOR: Record<ColorTier, { text: string; border: string; bg: string }> = {
  bad: { text: "text-rose-500", border: "border-rose-500", bg: "bg-rose-500/10" },
  medium: { text: "text-amber-400", border: "border-amber-400", bg: "bg-amber-400/10" },
  good: { text: "text-emerald-400", border: "border-emerald-400", bg: "bg-emerald-400/10" },
  neutral: { text: "text-slate-500", border: "border-slate-500", bg: "bg-slate-500/10" },
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

// A medium, thin-bordered colored circle with one icon centered inside --
// no progress arc, just a tier-colored badge, matching the reference's
// filled icon-circle look (green/amber/red) instead of a thin SVG ring.
function IconCircle({ tier, size, children }: { tier: ColorTier; size: number; children: React.ReactNode }) {
  const colors = TIER_COLOR[tier];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border-2 ${colors.border} ${colors.bg} ${colors.text}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

const ROW_H = 40;
const ROW_GAP = 16;

// Straight orthogonal bracket -- a short horizontal stub off the main
// node, a straight vertical line spanning down to the bottom sub-node,
// and a short horizontal tick into each sub-node. Plain right angles,
// not curves.
function BracketConnector() {
  const mainY = ROW_H / 2;
  const sub1Y = ROW_H + ROW_GAP + ROW_H / 2;
  const sub2Y = 2 * (ROW_H + ROW_GAP) + ROW_H / 2;
  const total = 3 * ROW_H + 2 * ROW_GAP;
  const stubW = 8;
  const innerInset = 8;

  return (
    <div className="relative w-5 shrink-0" style={{ height: total }}>
      {/* stub from the main node, at the outer edge */}
      <div className="absolute h-px bg-slate-700/60" style={{ insetInlineEnd: 0, width: stubW, top: mainY }} />
      {/* the vertical run from the main node's height down to the bottom
          sub-node, offset inward from the main stub */}
      <div
        className="absolute w-px bg-slate-700/60"
        style={{ insetInlineEnd: innerInset, top: mainY, height: sub2Y - mainY }}
      />
      {/* ticks into each sub-node */}
      <div className="absolute h-px bg-slate-700/60" style={{ insetInlineEnd: 0, width: innerInset, top: sub1Y }} />
      <div className="absolute h-px bg-slate-700/60" style={{ insetInlineEnd: 0, width: innerInset, top: sub2Y }} />
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

function MainRing({ value, status, tier, icon }: { value: number; status: string; tier: ColorTier; icon: React.ReactNode }) {
  const colors = TIER_COLOR[tier];
  return (
    <Row>
      <IconCircle tier={tier} size={36}>
        {icon}
      </IconCircle>
      <div className="flex flex-col items-start leading-tight">
        <span className={`text-[11px] font-semibold ${colors.text}`}>{status}</span>
        <span className={`text-base font-extrabold ${colors.text}`} dir="ltr">
          {Math.max(0, Math.min(100, Math.round(value)))}/100
        </span>
      </div>
    </Row>
  );
}

function SubRing({ value, label, icon, inverted }: { value: number; label: string; icon: React.ReactNode; inverted?: boolean }) {
  const tier = colorTierFor(value, !!inverted);
  const colors = TIER_COLOR[tier];
  return (
    <Row>
      <IconCircle tier={tier} size={30}>
        {icon}
      </IconCircle>
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
      <IconCircle tier="good" size={36}>
        <BoltIcon className="h-4 w-4" />
      </IconCircle>
      <span className="text-sm font-bold text-white">{label}</span>
    </Row>
  );
}

function SubNumber({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  return (
    <Row>
      <IconCircle tier="good" size={30}>
        {icon}
      </IconCircle>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-sm font-bold text-emerald-400" dir="ltr">{value}</span>
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

      <div className="grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-8">
        {/* First in DOM = right column under RTL: the main reliability node. */}
        <div className="flex items-start gap-0">
          <BracketConnector />
          <div className="flex min-w-0 flex-col" style={{ gap: ROW_GAP }}>
            <MainRing value={reliabilityScore} status={reliabilityStatus} tier={mainTier} icon={<ShieldIcon className="h-4 w-4" />} />
            <SubRing value={safetyScore} label={t("gaugeSafety")} icon={<LockIcon className="h-3.5 w-3.5" />} />
            <SubRing value={riskExposureScore} label={t("gaugeRiskExposure")} icon={<AlertTriangleIcon className="h-3.5 w-3.5" />} inverted />
          </div>
        </div>

        {/* Second in DOM = left column under RTL: trading-activity node. */}
        <div className="flex items-start gap-0">
          <BracketConnector />
          <div className="flex min-w-0 flex-col" style={{ gap: ROW_GAP }}>
            <MainBadge label={t("importantBadgeLabel")} />
            <SubNumber value={limitScore} label={t("gaugeLimitScore")} icon={<CheckIcon className="h-3.5 w-3.5" />} />
            <SubNumber value={activeTradingDays} label={t("gaugeTradingDays")} icon={<CalendarIcon className="h-3.5 w-3.5" />} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-700/70 pt-4">
        <h3 className="font-display text-sm font-extrabold">{t("equityChartTitle")}</h3>
        <TraderEquityChart signals={signals} />
      </div>
    </div>
  );
}
