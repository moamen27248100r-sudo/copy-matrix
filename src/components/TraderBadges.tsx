import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

// tier/risk_level are stored in the database as fixed Arabic strings (see
// provider_cards.tier / .risk_level) -- these map that raw DB value to both
// its style and its translation key, independent of the UI locale.
const TIER_STYLES: Record<string, string> = {
  "نخبة": "border-amber-500/40 bg-amber-500/10 text-amber-400",
  "محترف": "border-accent/40 bg-accent/10 text-accent",
  "متوسط": "border-sky-500/30 bg-sky-500/10 text-sky-400",
  "مبتدئ": "border-border bg-foreground/5 text-muted",
};

const TIER_KEYS: Record<string, string> = {
  "نخبة": "tierElite",
  "محترف": "tierPro",
  "متوسط": "tierIntermediate",
  "مبتدئ": "tierBeginner",
};

const RISK_STYLES: Record<string, string> = {
  "منخفضة": "border-success/40 bg-success/10 text-success",
  "متوسطة": "border-warning/40 bg-warning/10 text-warning",
  "مرتفعة": "border-danger/40 bg-danger/10 text-danger",
};

const RISK_KEYS: Record<string, string> = {
  "منخفضة": "riskLow",
  "متوسطة": "riskMedium",
  "مرتفعة": "riskHigh",
};

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 6.2 6.8.6-5.1 4.6 1.5 6.6L12 17.1 5.9 20.5l1.5-6.6-5.1-4.6 6.8-.6L12 2.5z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.6 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

const TIER_ICONS: Record<string, ReactNode> = {
  "نخبة": <StarIcon />,
  "محترف": <ShieldIcon />,
};

export async function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const t = await getTranslations("TraderBadges");
  const classes = TIER_STYLES[tier] ?? TIER_STYLES["مبتدئ"];
  const label = t(TIER_KEYS[tier] ?? "tierBeginner");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {TIER_ICONS[tier]}
      {label}
    </span>
  );
}

export async function RiskBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const t = await getTranslations("TraderBadges");
  const classes = RISK_STYLES[level] ?? "border-border bg-foreground/5 text-muted";
  const label = t(RISK_KEYS[level] ?? "riskMedium");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {level === "منخفضة" ? <ShieldIcon /> : <AlertIcon />}
      {t("riskLabel", { level: label })}
    </span>
  );
}

export async function StoppedBadge({ stopped }: { stopped: boolean }) {
  if (!stopped) return null;
  const t = await getTranslations("TraderBadges");
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted">
      <AlertIcon />
      {t("stoppedTrading")}
    </span>
  );
}
