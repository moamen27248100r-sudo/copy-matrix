"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { InstrumentIcon } from "@/components/markets/MarketsBoard";

export type Mover = { symbol: string; label: string; glyph: string; tone: string; price: string; change: number };

// The day's biggest gainers and losers, one list at a time behind two tabs.
export function MoversTabs({ gainers, losers }: { gainers: Mover[]; losers: Mover[] }) {
  const t = useTranslations("Dashboard");
  const id = useId();
  const [tab, setTab] = useState<"gainers" | "losers">(gainers.length > 0 ? "gainers" : "losers");
  const rows = tab === "gainers" ? gainers : losers;
  const tabs = [
    { key: "gainers" as const, label: t("moversGainers") },
    { key: "losers" as const, label: t("moversLosers") },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label={t("marketPulseTitle")} className="inline-flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            id={`${id}-${x.key}`}
            aria-selected={tab === x.key}
            aria-controls={`${id}-panel`}
            onClick={() => setTab(x.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${tab === x.key ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <ul id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} className="flex flex-col divide-y divide-border rounded-[20px] border border-border bg-surface">
        {rows.length === 0 && <li className="px-4 py-4 text-sm text-muted">{t("moversNone")}</li>}
        {rows.map((r) => (
          <li key={r.symbol}>
            <Link href={`/markets/${r.symbol}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03]">
              <InstrumentIcon glyph={r.glyph} toneClass={r.tone} size="h-8 w-8" />
              <span translate="no" dir="ltr" className="min-w-0 flex-1 truncate text-sm font-bold">
                {r.label}
              </span>
              <span translate="no" dir="ltr" className="text-sm tabular-nums">
                {r.price}
              </span>
              <span translate="no" dir="ltr" className={`w-20 text-end text-sm font-bold tabular-nums ${r.change >= 0 ? "text-success" : "text-danger"}`}>
                {r.change >= 0 ? "+" : ""}
                {r.change.toFixed(2)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
