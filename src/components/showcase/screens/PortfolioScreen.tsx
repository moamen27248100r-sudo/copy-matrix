import { useMoney } from "@/lib/money-client";
import { StatusBar, BottomNav } from "../ScreenChrome";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { showcasePortfolio, showcaseCopiedTraders } from "@/data/showcase-data";

// The bars used to sit inside a row with `items-end`, which never
// stretches its flex children to the row's own height -- so each bar's
// percentage `height` had no real basis to resolve against and
// collapsed to ~0, leaving a big empty gap instead of a chart. Switching
// to the (default) stretch alignment gives every column the row's full
// height to size its bar's percentage against.
function MonthlyBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values.map(Math.abs));
  return (
    <div className="flex h-full w-full gap-2.5" aria-hidden="true">
      {values.map((v, i) => {
        const up = v >= 0;
        const heightPct = Math.max(10, (Math.abs(v) / max) * 100);
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className={"w-full rounded-md " + (up ? "bg-[#22C55E]" : "bg-[#EF4444]")}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted">{labels[i]}</p>
          </div>
        );
      })}
    </div>
  );
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export function PortfolioScreen() {
  const t = useTranslations("HomeShowcase");
  const money = useMoney();
  const locale = useLocale();
  const monthLabels = Array.from({ length: 6 }, (_, i) => new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2025, i, 1)));
  const p = showcasePortfolio;
  const up = p.monthlyChangePct >= 0;
  return (
    <div className="flex h-full flex-col" dir="rtl" aria-hidden="true">
      <StatusBar />
      <div className="flex flex-1 flex-col gap-5 px-5 pt-5">
        <div>
          <p className="text-[13px] text-muted">{t("totalBalance")}</p>
          <p className="text-[32px] font-extrabold tabular-nums leading-tight text-white" dir="ltr">
            {money(p.balance)}
          </p>
          <p className={"text-[13px] font-semibold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
            {up ? "+" : ""}
            {p.monthlyChangePct}%
          </p>
        </div>

        <div className="h-28 w-full">
          <MonthlyBars values={p.monthlyBars} labels={monthLabels} />
        </div>

        <div className="flex flex-1 flex-col justify-end gap-2.5 pb-2">
          <p className="text-sm font-medium text-white">{t("tradersYouCopy")}</p>
          {showcaseCopiedTraders.map((c) => (
            <div key={c.name} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-[13px] font-bold text-white">
                {initialsOf(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-white">{c.name}</p>
                <p className="text-[12px] text-muted" dir="ltr">
                  {c.allocationPct}% ·{" "}
                  <span className={c.returnPct >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}>
                    {c.returnPct >= 0 ? "+" : ""}
                    {c.returnPct}%
                  </span>
                </p>
              </div>
              <span
                className={
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors " + (c.active ? "bg-accent" : "bg-white/10")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " +
                    (c.active ? "start-4.5" : "start-0.5")
                  }
                />
              </span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="wallet" />
    </div>
  );
}
