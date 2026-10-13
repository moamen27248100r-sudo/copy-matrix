import { getTranslations } from "next-intl/server";
import { getMoney } from "@/lib/money-server";

// Trading summary from the customer's closed trades (the statistics block every copy-trading
// dashboard has): win rate, number of trades, best / worst trade, average result, profit factor.
export async function PerformanceSummary({ pnls }: { pnls: number[] }) {
  const t = await getTranslations("Dashboard");
  const money = await getMoney();
  const total = pnls.length;
  if (total === 0) return null;

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossWin = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const winRate = (wins.length / total) * 100;
  const avg = pnls.reduce((s, p) => s + p, 0) / total;
  const best = Math.max(...pnls);
  const worst = Math.min(...pnls);
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;

  const stats = [
    { label: t("perfWinRate"), value: `${winRate.toFixed(1)}%`, tone: "" },
    { label: t("perfClosedTrades"), value: String(total), tone: "" },
    { label: t("perfBestTrade"), value: money(best, { signed: true }), tone: best > 0 ? "text-success" : "" },
    { label: t("perfWorstTrade"), value: money(worst, { signed: true }), tone: worst < 0 ? "text-danger" : "" },
    { label: t("perfAvgTrade"), value: money(avg, { signed: true }), tone: avg > 0 ? "text-success" : avg < 0 ? "text-danger" : "" },
    { label: t("perfProfitFactor"), value: profitFactor == null ? "—" : profitFactor.toFixed(2), tone: "" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("perfTitle")}</h2>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 text-start">
            <p className="text-xs text-muted">{s.label}</p>
            <p className={`mt-0.5 text-base font-semibold ${s.tone}`}>
              <span dir="ltr" className="inline-block">
                {s.value}
              </span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
