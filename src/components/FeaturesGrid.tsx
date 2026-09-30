import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

type RiskLevel = "low" | "medium" | "high";

// The sample indicator on the "risk indicator" card always reads "low".
const CARD3_RISK_LEVEL: RiskLevel = "low";

function CardIcon({ name, className }: { name: "zap" | "globe" | "settings"; className?: string }) {
  const paths: Record<typeof name, ReactNode> = {
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// Same semantic tokens (and the same border/bg/text pattern) as
// RISK_STYLES in TraderBadges.tsx (the leader-profile badge system), so a
// "low risk" reads identically here and on a trader's profile.
const RISK_LEVEL_CLASSES: Record<RiskLevel, string> = {
  low: "border-success/40 bg-success/10 text-success",
  medium: "border-warning/40 bg-warning/10 text-warning",
  high: "border-danger/40 bg-danger/10 text-danger",
};

const RISK_LEVEL_BAR: Record<RiskLevel, string> = {
  low: "bg-success",
  medium: "bg-warning",
  high: "bg-danger",
};

const ICON_BADGE_CLASSES: Record<"zap" | "globe" | "settings", string> = {
  // Amber for instant execution (speed), calm financial blue for both
  // markets and settings/control — no cyan/teal anywhere.
  zap: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  globe: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  settings: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

function IconBadge({ name }: { name: "zap" | "globe" | "settings" }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${ICON_BADGE_CLASSES[name]}`}>
      <CardIcon name={name} className="h-4 w-4" />
    </span>
  );
}

export function FeaturesGrid() {
  const t = useTranslations("HomeFeatures");

  return (
    <section className="bg-transparent px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div className="mx-auto flex flex-col items-center gap-1.5 text-center">
          <h2 className="line-clamp-1 text-2xl font-bold text-white sm:text-3xl">{t("title")}</h2>
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-400">{t("subtitle")}</p>
        </div>

        {/* No cards, no fills — features are separated by a hairline and
            generous spacing so the section reads as one open surface. */}
        <div className="flex flex-col divide-y divide-slate-800/50">
          {/* Feature 1: instant execution */}
          <div className="flex flex-col gap-3 py-8 first:pt-0">
            <IconBadge name="zap" />
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="line-clamp-1 text-lg font-bold text-white">{t("card1.title")}</h3>
            </div>
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-slate-400">{t("card1.desc")}</p>
          </div>

          {/* Feature 2: markets, as a real live-price ticker (no cards,
              no third-party widget) instead of boxed tiles. */}
          <div className="flex flex-col gap-3 py-8">
            <IconBadge name="globe" />
            <h3 className="line-clamp-1 text-lg font-bold text-white">{t("card2.title")}</h3>
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-slate-400">{t("card2.desc")}</p>
          </div>

          {/* Feature 3: smart control & risk gauge */}
          <div className="flex flex-col gap-3 py-8 last:pb-0">
            <IconBadge name="settings" />
            <h3 className="line-clamp-1 text-lg font-bold text-white">{t("card3.title")}</h3>
            <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-slate-400">{t("card3.desc")}</p>
            <div className="mt-1 flex max-w-xs items-center justify-between text-xs text-slate-400">
              <span>{t("card3.riskLabel")}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${RISK_LEVEL_CLASSES[CARD3_RISK_LEVEL]}`}>
                {t("card3.riskValue")}
              </span>
            </div>
            <div className="h-1 max-w-xs overflow-hidden rounded-full bg-white/5">
              <div className={`h-full w-1/4 rounded-full ${RISK_LEVEL_BAR[CARD3_RISK_LEVEL]}`} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
