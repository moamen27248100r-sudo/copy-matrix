"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "open", label: "الصفقات المفتوحة" },
  { key: "pending", label: "الأوامر المعلقة" },
  { key: "closed", label: "السجل" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
  const [tab, setTab] = useState<TabKey>("open");
  const counts: Partial<Record<TabKey, number>> = { open: openCount, closed: closedCount };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "flex-1 rounded-md bg-accent px-2 py-2 text-center text-xs font-medium text-accent-foreground transition sm:text-sm"
                : "flex-1 rounded-md px-2 py-2 text-center text-xs font-medium text-muted transition hover:text-foreground sm:text-sm"
            }
          >
            {t.label}
            {counts[t.key] != null && counts[t.key]! > 0 && (
              <span className="ms-1 text-[11px] opacity-80">({counts[t.key]})</span>
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
