"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "positions", label: "الصفقات" },
  { key: "activity", label: "المعاملات" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PortfolioTabs({
  overview,
  positions,
  activity,
}: {
  overview: ReactNode;
  positions: ReactNode;
  activity: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("overview");
  const panels: Record<TabKey, ReactNode> = { overview, positions, activity };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={
              active === t.key
                ? "flex-1 rounded bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition"
                : "flex-1 rounded px-3 py-2 text-sm text-muted transition hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {panels[active]}
    </div>
  );
}
