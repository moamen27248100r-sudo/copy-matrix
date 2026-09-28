"use client";

import Link from "next/link";
import { useState } from "react";
import { MiniSpark } from "@/components/landing/MiniSpark";
import { CountOnView } from "@/components/landing/CountOnView";
import { useInView } from "@/components/landing/useInView";
import type { LandingTrader } from "@/lib/landing-data";

export type TraderCardLabels = {
  return12: string;
  maxDd: string;
  risk: string;
  copiers: string;
  copy: string;
  pastPerf: string;
};

export type TraderCardData = LandingTrader & {
  countryLabel: string;
  marketLabel: string;
  profileHref: string;
  copyHref: string;
};

type Tab = { key: string; label: string; items: TraderCardData[] };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

function TraderCard({ t, labels }: { t: TraderCardData; labels: TraderCardLabels }) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <article ref={ref} className="relative flex min-h-[260px] w-[280px] shrink-0 snap-start flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong md:w-auto">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-foreground"
          aria-hidden="true"
        >
          {initials(t.name)}
        </span>
        <div className="min-w-0">
          <Link href={t.profileHref} className="block truncate text-base font-semibold text-foreground after:absolute after:inset-0 after:content-['']">
            {t.name}
          </Link>
          <p className="truncate text-sm text-muted">
            {t.countryLabel}
            {t.countryLabel && t.marketLabel ? " · " : ""}
            {t.marketLabel}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={`num text-3xl font-semibold ${t.ret >= 0 ? "text-up" : "text-down"}`}>
            <CountOnView value={t.ret} decimals={1} suffix="%" signed />
          </p>
          <p className="text-sm text-muted">{labels.return12}</p>
        </div>
        <MiniSpark series={t.series} drawn={inView} className="h-9 w-24 shrink-0" />
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted">{labels.maxDd}</dt>
          <dd className="num font-medium">{t.dd > 0 ? `-${t.dd.toFixed(1)}%` : "0.0%"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{labels.risk}</dt>
          <dd className="num font-medium">{t.risk}/10</dd>
        </div>
        {t.followers >= 5 && (
          <div>
            <dt className="text-xs text-muted">{labels.copiers}</dt>
            <dd className="num font-medium">{t.followers.toLocaleString("en-US")}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted">{labels.pastPerf}</p>
        <Link
          href={t.copyHref}
          className="relative z-10 shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {labels.copy}
        </Link>
      </div>
    </article>
  );
}

export function TradersTabs({ tabs, labels }: { tabs: Tab[]; labels: TraderCardLabels }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={t.key === active}
            onClick={() => setActive(t.key)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm transition-colors ${
              t.key === active
                ? "border-primary bg-primary text-white"
                : "border-border text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3"
      >
        {current.items.slice(0, 6).map((t) => (
          <TraderCard key={t.id} t={t} labels={labels} />
        ))}
      </div>
    </div>
  );
}
