import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { fetchLeadTraderHistory } from "@/lib/lead-trader-history";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadTradesHistoryTitle"), description: t("leadTradesHistoryDesc") };
}

export default async function LeadTradesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; result?: string; days?: string }>;
}) {
  const { symbol, result, days } = await searchParams;
  const t = await getTranslations("LeadTrader.trades");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead%2Ftrades%2Fhistory");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const daysNum = Number(days);
  const filters = { symbol: symbol || undefined, result: result || undefined, days: Number.isFinite(daysNum) && daysNum > 0 ? daysNum : undefined };
  const { rows, symbols } = await fetchLeadTraderHistory(supabase, providerId, filters);
  const exportQs = new URLSearchParams(Object.entries({ symbol, result, days }).filter(([, v]) => !!v) as [string, string][]);
  const select = "rounded-lg border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-page-title">{t("historyTitle")}</h1>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <select name="symbol" defaultValue={symbol ?? ""} className={select}>
          <option value="">{t("allSymbols")}</option>
          {symbols.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="result" defaultValue={result ?? ""} className={select}>
          <option value="">{t("allResults")}</option>
          <option value="win">{t("resultWin")}</option>
          <option value="loss">{t("resultLoss")}</option>
        </select>
        <select name="days" defaultValue={days ?? ""} className={select}>
          <option value="">{t("allTime")}</option>
          {[7, 30, 90, 180].map((d) => (
            <option key={d} value={d}>
              {t("lastDays", { days: d })}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
          {t("apply")}
        </button>
        <a href={`/lead/trades/history/export?${exportQs.toString()}`} className="ms-auto rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent">
          {t("exportCsv")}
        </a>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("noHistory")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 text-start font-normal">{t("asset")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("side")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("entryExit")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("result")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("copiers")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-medium" dir="ltr">
                    {r.symbol}
                  </td>
                  <td className="px-3 py-2">{r.side === "buy" ? t("buy") : t("sell")}</td>
                  <td className="px-3 py-2 tabular-nums" dir="ltr">
                    {r.entryPrice} → {r.exitPrice}
                  </td>
                  <td className={`px-3 py-2 tabular-nums ${r.pct >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                    {r.pct >= 0 ? "+" : ""}
                    {r.pct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.copiers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
