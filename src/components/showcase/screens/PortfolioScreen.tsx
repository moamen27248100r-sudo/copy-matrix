import { StatusBar, BottomNav } from "../ScreenChrome";
import { showcasePortfolio, showcaseCopiedTraders } from "@/data/showcase-data";

function MonthlyBars({ values }: { values: number[] }) {
  const max = Math.max(...values.map(Math.abs));
  return (
    <div className="flex h-16 items-end gap-2" aria-hidden="true">
      {values.map((v, i) => {
        const up = v >= 0;
        const heightPct = Math.max(12, (Math.abs(v) / max) * 100);
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div
              className={"w-full rounded-sm " + (up ? "bg-[#22C55E]" : "bg-[#EF4444]")}
              style={{ height: `${heightPct}%` }}
            />
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
  const p = showcasePortfolio;
  const up = p.monthlyChangePct >= 0;
  return (
    <div className="flex h-full flex-col" dir="rtl" aria-hidden="true">
      <StatusBar />
      <div className="flex flex-1 flex-col gap-4 px-4 pt-4">
        <div>
          <p className="text-[11px] text-muted">الرصيد الإجمالي</p>
          <p className="text-2xl font-extrabold tabular-nums text-white" dir="ltr">
            ${p.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className={"text-[11px] font-semibold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
            {up ? "+" : ""}
            {p.monthlyChangePct}%
          </p>
        </div>

        <MonthlyBars values={p.monthlyBars} />

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium text-white">المتداولون الذين تنسخهم</p>
          {showcaseCopiedTraders.map((c) => (
            <div key={c.name} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-[10px] font-bold text-white">
                {initialsOf(c.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-white">{c.name}</p>
                <p className="text-[9px] text-muted" dir="ltr">
                  {c.allocationPct}% ·{" "}
                  <span className={c.returnPct >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}>
                    {c.returnPct >= 0 ? "+" : ""}
                    {c.returnPct}%
                  </span>
                </p>
              </div>
              <span
                className={
                  "relative h-4 w-7 shrink-0 rounded-full transition-colors " + (c.active ? "bg-accent" : "bg-white/10")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all " +
                    (c.active ? "start-3.5" : "start-0.5")
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
