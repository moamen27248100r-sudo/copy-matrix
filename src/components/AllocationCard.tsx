"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PortfolioAllocationDonut } from "@/components/PortfolioAllocationDonut";

type Slice = { label: string; value: number };

// The allocation donut with two views: reserved capital per trader, and open value per asset
// class (gold & metals, forex, crypto) with the part of the balance that is not invested.
export function AllocationCard({
  byTrader,
  byAsset,
  totalLabel,
  totalValue,
}: {
  byTrader: Slice[];
  byAsset: Slice[];
  totalLabel: string;
  totalValue: number;
}) {
  const t = useTranslations("Dashboard");
  const [view, setView] = useState<"trader" | "asset">("trader");
  const tabs = [
    { key: "trader" as const, label: t("allocationTabTrader") },
    { key: "asset" as const, label: t("allocationTabAsset") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("portfolioAllocationTitle")} className="inline-flex self-center rounded-full border border-border bg-background p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={view === tab.key}
            onClick={() => setView(tab.key)}
            className={
              view === tab.key
                ? "min-h-9 rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground"
                : "min-h-9 rounded-full px-4 text-xs font-medium text-muted transition hover:text-foreground"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <PortfolioAllocationDonut
        key={view}
        slices={view === "trader" ? byTrader : byAsset}
        totalLabel={totalLabel}
        totalValue={totalValue}
      />
    </div>
  );
}
