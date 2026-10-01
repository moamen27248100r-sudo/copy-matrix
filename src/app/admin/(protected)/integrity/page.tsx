import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

type Report = {
  id: number;
  run_at: string;
  window_start: string;
  window_end: string;
  signals_checked: number;
  positions_checked: number;
  issue_count: number;
  status: "ok" | "issues";
  summary: Record<string, number>;
  issues: { tbl: string; row_id: string; category: string; detail: string }[];
};

// Last 30 runs of the daily trade-integrity check (0219,
// run_trade_integrity_check). Read-only: the check never corrects trades.
export default async function AdminIntegrityPage() {
  const t = await getTranslations("AdminIntegrity");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();

  const { data } = await supabase
    .from("trade_integrity_reports")
    .select("id, run_at, window_start, window_end, signals_checked, positions_checked, issue_count, status, summary, issues")
    .order("run_at", { ascending: false })
    .limit(30);
  const reports = (data ?? []) as Report[];

  return (
    <>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-xs text-muted">{t("subtitle")}</p>

      {reports.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{formatDateTime(r.run_at, locale)}</span>
                <span
                  className={
                    r.status === "ok"
                      ? "rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400"
                      : "rounded bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400"
                  }
                >
                  {r.status === "ok" ? t("statusOk") : t("statusIssues", { count: r.issue_count })}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {t("checked", { signals: r.signals_checked, positions: r.positions_checked })}
              </p>
              {r.status === "issues" && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-accent">{t("showIssues")}</summary>
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-muted" dir="ltr">
                    {Object.entries(r.summary).map(([k, n]) => (
                      <li key={k}>
                        {k}: {n}
                      </li>
                    ))}
                    {r.issues.map((i) => (
                      <li key={`${i.tbl}-${i.row_id}-${i.detail}`} className="break-all font-mono">
                        {i.tbl} {i.row_id} — {i.category}:{i.detail}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
