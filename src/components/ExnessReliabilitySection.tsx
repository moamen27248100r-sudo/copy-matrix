"use client";

import { useEffect, useRef, useState } from "react";
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

// Calm pastel palette (soft green / amber / soft red) instead of saturated
// traffic-light colors. Text colors are lighter tints of the same hue so they
// stay readable on the dark surface.
const TIER_COLOR: Record<ColorTier, { text: string; ring: string }> = {
  bad: { text: "text-[#f0a3ab]", ring: "#e88a94" },
  medium: { text: "text-[#ecd08a]", ring: "#e3bd6a" },
  good: { text: "text-[#9bdcb8]", ring: "#7ccfa3" },
  neutral: { text: "text-slate-400", ring: "#64748b" },
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

// A real progress ring: the arc fills to value/100 (74/100 = 74%) and
// animates in once it scrolls into view (instantly under reduced motion).
// Without a value it is a plain tier-colored icon badge.
function IconCircle({ tier, size, value, animate, children }: { tier: ColorTier; size: number; value?: number; animate: boolean; children: React.ReactNode }) {
  const colors = TIER_COLOR[tier];
  const stroke = size >= 34 ? 3.5 : 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value == null ? 1 : Math.max(0, Math.min(100, value)) / 100;
  const offset = circ * (1 - (animate ? pct : 0));
  return (
    <span className={`relative flex shrink-0 items-center justify-center ${colors.text}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90 rtl:scale-x-[-1]" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.ring} strokeOpacity={0.18} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
        />
      </svg>
      {children}
    </span>
  );
}

// Info tooltip trigger: hover/focus on desktop, tap on touch. The bubble is
// rendered by the section (see Tip) so it can never overflow a half-width column.
type TipKey = "reliability" | "safety" | "risk" | "limit" | "days" | "badge";
type TipState = { key: TipKey; top: number } | null;

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

type TipHandlers = {
  animate: boolean;
  activeTip: TipKey | null;
  showTip: (key: TipKey, el: HTMLElement) => void;
  hideTip: () => void;
  toggleTip: (key: TipKey, el: HTMLElement) => void;
};

function Row({ tipKey, tip, children }: { tipKey: TipKey; tip: TipHandlers; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={tip.activeTip === tipKey}
      onMouseEnter={(e) => tip.showTip(tipKey, e.currentTarget)}
      onMouseLeave={tip.hideTip}
      onFocus={(e) => tip.showTip(tipKey, e.currentTarget)}
      onBlur={tip.hideTip}
      onClick={(e) => tip.toggleTip(tipKey, e.currentTarget)}
      className="flex w-full min-w-0 cursor-help items-center gap-2.5 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      style={{ height: ROW_H }}
    >
      {children}
    </button>
  );
}

const clampScore = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function MainRing({ value, status, tier, icon, tip }: { value: number; status: string; tier: ColorTier; icon: React.ReactNode; tip: TipHandlers }) {
  const colors = TIER_COLOR[tier];
  return (
    <Row tipKey="reliability" tip={tip}>
      <IconCircle tier={tier} size={36} value={clampScore(value)} animate={tip.animate}>
        {icon}
      </IconCircle>
      <div className="flex min-w-0 flex-col items-start leading-tight">
        <span className={`text-[11px] font-semibold ${colors.text}`}>{status}</span>
        <span className={`text-base font-extrabold ${colors.text}`} dir="ltr">
          {clampScore(value)}/100
        </span>
      </div>
    </Row>
  );
}

function SubRing({ tipKey, value, label, icon, inverted, tip }: { tipKey: TipKey; value: number; label: string; icon: React.ReactNode; inverted?: boolean; tip: TipHandlers }) {
  const tier = colorTierFor(value, !!inverted);
  const colors = TIER_COLOR[tier];
  return (
    <Row tipKey={tipKey} tip={tip}>
      <IconCircle tier={tier} size={30} value={clampScore(value)} animate={tip.animate}>
        {icon}
      </IconCircle>
      <div className="flex min-w-0 flex-col items-start leading-tight">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className={`text-sm font-bold ${colors.text}`} dir="ltr">
          {clampScore(value)}/100
        </span>
      </div>
    </Row>
  );
}

function MainBadge({ label, tip }: { label: string; tip: TipHandlers }) {
  return (
    <Row tipKey="badge" tip={tip}>
      <IconCircle tier="good" size={36} animate={tip.animate}>
        <BoltIcon className="h-4 w-4" />
      </IconCircle>
      <span className="text-sm font-bold text-white">{label}</span>
    </Row>
  );
}

function SubNumber({ tipKey, value, label, icon, tip }: { tipKey: TipKey; value: number; label: string; icon: React.ReactNode; tip: TipHandlers }) {
  return (
    <Row tipKey={tipKey} tip={tip}>
      <IconCircle tier="good" size={30} animate={tip.animate}>
        {icon}
      </IconCircle>
      <div className="flex min-w-0 flex-col items-start leading-tight">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-sm font-bold text-[#9bdcb8]" dir="ltr">{value}</span>
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
  const gridRef = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);
  const [tipState, setTipState] = useState<TipState>(null);
  const pinned = useRef(false);

  // Rings fill once, the first time the grid scrolls into view.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // A tapped (pinned) tooltip closes on any outside tap or Escape.
  useEffect(() => {
    if (!tipState) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof PointerEvent && (e.target as HTMLElement).closest?.("[data-tip-row]")) return;
      pinned.current = false;
      setTipState(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [tipState]);

  const place = (key: TipKey, el: HTMLElement) => {
    const grid = gridRef.current;
    if (!grid) return;
    const top = el.getBoundingClientRect().bottom - grid.getBoundingClientRect().top + 6;
    setTipState({ key, top });
  };

  const tip: TipHandlers = {
    animate,
    activeTip: tipState?.key ?? null,
    showTip: (key, el) => {
      if (!pinned.current) place(key, el);
    },
    hideTip: () => {
      if (!pinned.current) setTipState(null);
    },
    toggleTip: (key, el) => {
      if (pinned.current && tipState?.key === key) {
        pinned.current = false;
        setTipState(null);
      } else {
        pinned.current = true;
        place(key, el);
      }
    },
  };

  const TIP_TEXT: Record<TipKey, string> = {
    reliability: t("gaugeTipReliability"),
    safety: t("gaugeTipSafety"),
    risk: t("gaugeTipRisk"),
    limit: t("gaugeTipLimit"),
    days: t("gaugeTipTradingDays"),
    badge: t("gaugeTipBadge"),
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-base font-extrabold">{t("reliabilitySectionTitle")}</h2>

      <div ref={gridRef} className="relative grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-x-8">
        {/* First in DOM = right column under RTL: the main reliability node. */}
        <div className="flex items-start gap-0" data-tip-row>
          <BracketConnector />
          <div className="flex min-w-0 flex-1 flex-col" style={{ gap: ROW_GAP }}>
            <MainRing value={reliabilityScore} status={reliabilityStatus} tier={mainTier} icon={<ShieldIcon className="h-4 w-4" />} tip={tip} />
            <SubRing tipKey="safety" value={safetyScore} label={t("gaugeSafety")} icon={<LockIcon className="h-3.5 w-3.5" />} tip={tip} />
            <SubRing tipKey="risk" value={riskExposureScore} label={t("gaugeRiskExposure")} icon={<AlertTriangleIcon className="h-3.5 w-3.5" />} inverted tip={tip} />
          </div>
        </div>

        {/* Second in DOM = left column under RTL: trading-activity node. */}
        <div className="flex items-start gap-0" data-tip-row>
          <BracketConnector />
          <div className="flex min-w-0 flex-1 flex-col" style={{ gap: ROW_GAP }}>
            <MainBadge label={t("importantBadgeLabel")} tip={tip} />
            <SubNumber tipKey="limit" value={limitScore} label={t("gaugeLimitScore")} icon={<CheckIcon className="h-3.5 w-3.5" />} tip={tip} />
            <SubNumber tipKey="days" value={activeTradingDays} label={t("gaugeTradingDays")} icon={<CalendarIcon className="h-3.5 w-3.5" />} tip={tip} />
          </div>
        </div>

        {tipState && (
          <div
            role="tooltip"
            className="pointer-events-none absolute inset-x-0 z-20 mx-auto w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-foreground shadow-lg shadow-black/40"
            style={{ top: tipState.top }}
          >
            {TIP_TEXT[tipState.key]}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-slate-700/70 pt-4">
        <h3 className="font-display text-sm font-extrabold">{t("equityChartTitle")}</h3>
        <TraderEquityChart signals={signals} />
      </div>
    </div>
  );
}
