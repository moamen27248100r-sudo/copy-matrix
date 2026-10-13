import { getTranslations } from "next-intl/server";
import { getMoney } from "@/lib/money-server";

export type ClosedStats = {
  closed_count: number;
  wins: number;
  losses: number;
  best: number | null;
  worst: number | null;
  gross_win: number;
  gross_loss: number;
  realized: number;
};

// Trading summary from the customer's closed trades (the statistics block every copy-trading
// dashboard has): win rate, number of trades, best / worst trade, average result, profit factor.
// The figures are computed in the database (dashboard_summary, migration 0254).
export async function PerformanceSummary({ stats }: { stats: ClosedStats }) {
  const t = await getTranslations("Dashboard");
  const money = await getMoney();
  const total = Number(stats.closed_count);
  if (total === 0) return null;

  const winRate = (Number(stats.wins) / total) * 100;
  const avg = Number(stats.realized) / total;
  const best = Number(stats.best ?? 0);
  const worst = Number(stats.worst ?? 0);
  const grossLoss = Number(stats.gross_loss);
  const profitFactor = grossLoss > 0 ? Number(stats.gross_win) / grossLoss : null;

  const items = [
    { label: t("perfWinRate"), value: `${winRate.toFixed(1)}%`, tone: "" },
    { label: t("perfClosedTrades"), value: String(total), tone: "" },
    { label: t("perfBestTrade"), value: money(best, { signed: true }), tone: best > 0 ? "text-success" : "" },
    { label: t("perfWorstTrade"), value: money(worst, { signed: true }), tone: worst < 0 ? "text-danger" : "" },
    { label: t("perfAvgTrade"), value: money(avg, { signed: true }), tone: avg > 0 ? "text-success" : avg < 0 ? "text-danger" : "" },
    { label: t("perfProfitFactor"), value: profitFactor == null ? "—" : profitFactor.toFixed(2), tone: "" },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("perfTitle")}</h2>
        <a href="/trades/export" download className="tap-44 text-sm text-accent hover:underline">
          {t("exportTradesCsv")}
        </a>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3">
        {items.map((s) => (
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
