"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

export type SimTrader = { id: string; name: string; ret: number; dd: number; series: number[] };

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

// "If you had copied": pick one of the listed traders and an amount; the monthly
// growth curve is built from that trader's own last-12-month series (returns add
// up on a fixed allocation, as in the copy engine). Past performance only.
export function CopySimulator({ traders }: { traders: SimTrader[] }) {
  const t = useTranslations("Landing");
  const [id, setId] = useState(traders[0]?.id ?? "");
  const [amount, setAmount] = useState(1000);
  const tr = traders.find((x) => x.id === id) ?? traders[0];

  const sim = useMemo(() => {
    if (!tr) return null;
    const cum = [0, ...tr.series];
    const values = cum.map((c) => amount * (1 + c / 100));
    const deltas = cum.slice(1).map((c, i) => c - cum[i]);
    const worst = Math.min(...deltas);
    return {
      values,
      final: values[values.length - 1],
      worstMonth: worst < 0 ? (amount * worst) / 100 : null,
      maxDd: (amount * tr.dd) / 100,
    };
  }, [tr, amount]);

  if (!tr || !sim) return null;

  const W = 560;
  const H = 180;
  const min = Math.min(...sim.values, amount);
  const max = Math.max(...sim.values, amount);
  const span = max - min || 1;
  const pts = sim.values.map((v, i) => [(i / Math.max(1, sim.values.length - 1)) * W, H - 8 - ((v - min) / span) * (H - 16)] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const up = sim.final >= amount;

  return (
    <div className="grid gap-8 rounded-2xl border border-border bg-surface p-5 md:p-8 lg:grid-cols-[1fr_1.3fr]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("simTrader")}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("simTrader")}>
            {traders.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={x.id === tr.id}
                onClick={() => setId(x.id)}
                className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                  x.id === tr.id ? "border-primary bg-primary text-white" : "border-border text-muted hover:border-border-strong hover:text-foreground"
                }`}
              >
                {x.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <label htmlFor="sim-amount" className="text-sm font-medium">
              {t("simAmount")}
            </label>
            <span className="num text-2xl font-semibold">${amount.toLocaleString("en-US")}</span>
          </div>
          <input
            id="sim-amount"
            type="range"
            min={100}
            max={10000}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="landing-range w-full"
            dir="ltr"
          />
          <div className="flex justify-between text-xs text-muted" dir="ltr">
            <span className="num">$100</span>
            <span className="num">$10,000</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-muted">{t("simFinal")}</p>
          <p className={`num text-4xl font-semibold ${up ? "text-up" : "text-down"}`}>${Math.round(sim.final).toLocaleString("en-US")}</p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("simChartAlt")} style={{ direction: "ltr" }}>
          <line x1="0" x2={W} y1={H - 8 - ((amount - min) / span) * (H - 16)} y2={H - 8 - ((amount - min) / span) * (H - 16)} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <dt className="text-sm text-muted">{t("simWorstMonth")}</dt>
            <dd className="text-lg font-semibold">{sim.worstMonth === null ? t("simNoLoss") : <bdi className="num">{`-${usd(sim.worstMonth)}`}</bdi>}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">{t("maxDd")}</dt>
            <dd className="text-lg font-semibold">
              <bdi className="num">{sim.maxDd > 0 ? `-${usd(sim.maxDd)}` : "$0"}</bdi>
            </dd>
          </div>
        </dl>
      </div>
      <p className="text-sm leading-6 text-muted lg:col-span-2">{t("simNote")}</p>
    </div>
  );
}
