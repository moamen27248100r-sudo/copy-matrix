"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

const TAB_KEYS = ["overview", "positions", "activity"] as const;

type TabKey = (typeof TAB_KEYS)[number];

const isTabKey = (v: string | undefined): v is TabKey => TAB_KEYS.includes(v as TabKey);

export function PortfolioTabs({
  overview,
  positions,
  activity,
  initialTab,
}: {
  overview: ReactNode;
  positions: ReactNode;
  activity: ReactNode;
  initialTab?: string;
}) {
  const t = useTranslations("Portfolio");
  const [active, setActive] = useState<TabKey>(isTabKey(initialTab) ? initialTab : "overview");
  const panels: Record<TabKey, ReactNode> = { overview, positions, activity };
  const labels: Record<TabKey, string> = { overview: t("tabOverview"), positions: t("tabPositions"), activity: t("tabActivity") };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-1">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={
              active === key
                ? "flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition"
                : "flex-1 rounded px-3 py-2 text-sm text-muted transition hover:text-foreground"
            }
          >
            {labels[key]}
          </button>
        ))}
      </div>
      {panels[active]}
    </div>
  );
}
