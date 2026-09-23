"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

const TAB_KEYS = ["open", "pending", "closed"] as const;

type TabKey = (typeof TAB_KEYS)[number];

export function PositionTabs({
  open,
  pending,
  closed,
  openCount,
  closedCount,
}: {
  open: ReactNode;
  pending: ReactNode;
  closed: ReactNode;
  openCount?: number;
  closedCount?: number;
}) {
  const t = useTranslations("Portfolio");
  const [tab, setTab] = useState<TabKey>("open");
  const counts: Partial<Record<TabKey, number>> = { open: openCount, closed: closedCount };
  const labels: Record<TabKey, string> = { open: t("openPositionsTab"), pending: t("pendingOrders"), closed: t("history") };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "flex-1 rounded-md bg-accent px-2 py-2 text-center text-xs font-medium text-accent-foreground transition sm:text-sm"
                : "flex-1 rounded-md px-2 py-2 text-center text-xs font-medium text-muted transition hover:text-foreground sm:text-sm"
            }
          >
            {labels[key]}
            {counts[key] != null && counts[key]! > 0 && (
              <span className="ms-1 text-[11px] opacity-80">({counts[key]})</span>
            )}
          </button>
        ))}
      </div>
      {tab === "open" && open}
      {tab === "pending" && pending}
      {tab === "closed" && closed}
    </div>
  );
}
