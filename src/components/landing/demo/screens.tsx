"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { MiniSpark } from "@/components/landing/MiniSpark";
import { Logo } from "@/components/Logo";

// Lightweight look-alikes of the dashboard screens, with fixed sample data (no
// sign-in, no database). Drawn for a 375px-wide canvas.

const money = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function TopBar() {
  const t = useTranslations("Landing");
  return (
    <div className="flex h-14 items-center justify-between border-b border-border px-4">
      <Logo iconClassName="h-3.5 w-3.5" textClassName="text-base" />
      <span className="rounded-full border border-warning/40 px-3 py-1 text-xs text-warning">{t("scrDemoAccount")}</span>
    </div>
  );
}

const SAMPLE = [
  { name: "scrT1", country: "scrC1", ret: 38.4, dd: 6.2, risk: 3, copiers: 412, series: [2, 5, 4, 9, 13, 17, 16, 22, 27, 31, 35, 38.4] },
  { name: "scrT2", country: "scrC2", ret: 27.9, dd: 4.1, risk: 2, copiers: 268, series: [1, 3, 6, 5, 9, 12, 15, 14, 19, 23, 26, 27.9] },
  { name: "scrT3", country: "scrC3", ret: 52.6, dd: 9.8, risk: 4, copiers: 590, series: [3, 2, 8, 14, 12, 21, 27, 33, 30, 41, 47, 52.6] },
] as const;

export function TraderListScreen() {
  const t = useTranslations("Landing");
  return (
    <div className="h-full bg-background">
      <TopBar />
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-2xl font-semibold">{t("scrDiscover")}</h3>
        {SAMPLE.map((s) => (
          <div key={s.name} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{t(s.name).charAt(0)}</span>
              <div>
                <p className="text-base font-semibold">{t(s.name)}</p>
                <p className="text-sm text-muted">{t(s.country)}</p>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="num text-3xl font-semibold text-up">+{s.ret.toFixed(1)}%</p>
                <p className="text-sm text-muted">{t("return12")}</p>
              </div>
              <MiniSpark series={[...s.series]} className="h-9 w-24" />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted">
                {t("maxDd")} <span className="num text-foreground">-{s.dd.toFixed(1)}%</span>
              </span>
              <span className="text-muted">
                {t("riskLabel")} <span className="num text-foreground">{s.risk}/10</span>
              </span>
              <span className="text-muted">
                {t("copiers")} <span className="num text-foreground">{s.copiers}</span>
              </span>
            </div>
            <div className="rounded-xl bg-primary py-2 text-center text-sm font-medium text-white">{t("copy")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CopyDialogScreen() {
  const t = useTranslations("Landing");
  return (
    <div className="relative h-full bg-background">
      <TopBar />
      <div className="p-4 opacity-40">
        <h3 className="text-2xl font-semibold">{t(SAMPLE[0].name)}</h3>
        <div className="mt-4 h-40 rounded-2xl border border-border bg-surface" />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-3xl border-t border-border-strong bg-surface p-5">
        <p className="text-lg font-semibold">{t("scrCopyTitle", { name: t(SAMPLE[0].name) })}</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t("mockAmount")}</span>
          <div className="num rounded-xl border border-border-strong bg-background px-4 py-3 text-lg font-medium">$1,000</div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{t("mockLossLimit")}</span>
            <span className="num font-semibold">50%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2">
            <div className="h-full w-1/2 rounded-full bg-primary" />
          </div>
          <p className="text-sm leading-6 text-muted">{t("scrStopNote")}</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-primary bg-primary text-[10px] text-white">✓</span>
          {t("scrRiskAck")}
        </label>
        <div className="rounded-xl bg-primary py-3 text-center text-base font-medium text-white">{t("scrStart")}</div>
      </div>
    </div>
  );
}

function useLiveProfit(base: number, active: boolean, seed: number) {
  const [v, setV] = useState(base);
  useEffect(() => {
    if (!active) return;
    let x = seed;
    const id = setInterval(() => {
      x = (x * 9301 + 49297) % 233280;
      setV((p) => Math.max(base - 12, Math.min(base + 26, p + ((x / 233280) - 0.42) * 3.2)));
    }, 1000);
    return () => clearInterval(id);
  }, [active, base, seed]);
  return v;
}

export function MyCopiesScreen({ live = false }: { live?: boolean }) {
  const t = useTranslations("Landing");
  const p1 = useLiveProfit(86.4, live, 3);
  const p2 = useLiveProfit(41.2, live, 8);
  const total = p1 + p2 + 18.7;
  const copies = [
    { name: t(SAMPLE[0].name), amount: 1000, profit: p1, used: 8 },
    { name: t(SAMPLE[1].name), amount: 600, profit: p2, used: 14 },
  ];
  return (
    <div className="h-full bg-background">
      <TopBar />
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-2xl font-semibold">{t("scrMyCopies")}</h3>
        <div className="grid grid-cols-3 rounded-2xl border border-border bg-surface text-center">
          <div className="p-3">
            <p className="num text-lg font-semibold">2</p>
            <p className="text-xs text-muted">{t("scrActive")}</p>
          </div>
          <div className="border-s border-border p-3">
            <p className="num text-lg font-semibold">$1,600</p>
            <p className="text-xs text-muted">{t("scrAllocated")}</p>
          </div>
          <div className="border-s border-border p-3">
            <p className="num text-lg font-semibold text-up">+${money(total)}</p>
            <p className="text-xs text-muted">{t("scrProfit")}</p>
          </div>
        </div>
        {copies.map((c) => (
          <div key={c.name} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold">{c.name.charAt(0)}</span>
                <div>
                  <p className="text-base font-semibold">{c.name}</p>
                  <p className="num text-sm text-muted">${c.amount.toLocaleString("en-US")}</p>
                </div>
              </div>
              <span className="num text-lg font-semibold text-up">+${money(c.profit)}</span>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{t("lossNow")}</span>
                <span className="num">
                  {c.used}% / 50%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(c.used / 50) * 100}%` }} />
              </div>
            </div>
            <div className="rounded-xl border border-border-strong py-2 text-center text-sm text-muted">{t("mockStop")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simplified desktop dashboard for the closing composition.
export function MiniDashboard() {
  const t = useTranslations("Landing");
  return (
    <div className="flex h-[380px] flex-col gap-4 bg-background p-5">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">{t("scrGreeting")}</p>
        <span className="rounded-full border border-warning/40 px-3 py-1 text-xs text-warning">{t("scrDemoAccount")}</span>
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">{t("scrPortfolio")}</p>
          <p className="num text-3xl font-semibold">$10,146.30</p>
          <p className="num text-sm text-up">+$146.30 (+1.46%)</p>
          <MiniSpark series={[0, 8, 5, 14, 22, 19, 31, 40, 38, 52, 61, 74]} className="h-24 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">{t("scrMyCopies")}</p>
          {[SAMPLE[0], SAMPLE[1]].map((s, i) => (
            <div key={s.name} className="flex items-center justify-between border-b border-border pb-2 last:border-b-0">
              <span className="text-sm font-medium">{t(s.name)}</span>
              <span className="num text-sm text-up">+${i === 0 ? "86.40" : "41.20"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
