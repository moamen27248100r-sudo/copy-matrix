import { getMoney } from "@/lib/money-server";
import type { Locale } from "@/i18n/locales";
import { formatDate } from "@/lib/locale-format";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// The customer's own profit-share deductions and refunds across every trader they copy (a tab of
// "Copies"; the old /profit-share-history address redirects there).
export async function ProfitShareLedger({ userId }: { userId: string }) {
  const t = await getTranslations("LeadTrader.followerLedger");
  const money = await getMoney();
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("profit_share_ledger")
    .select("id, provider_id, period_start, period_end, gross_pnl, profit_share_pct, profit_share_amount, status")
    .eq("follower_id", userId)
    .order("period_end", { ascending: false });

  const providerIds = Array.from(new Set((rows ?? []).map((r) => r.provider_id)));
  const { data: providers } = providerIds.length
    ? await supabase.from("providers").select("id, display_name").in("id", providerIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((providers ?? []).map((p) => [p.id, p.display_name]));
  const totalDeducted = (rows ?? []).filter((r) => r.status === "settled").reduce((sum, r) => sum + Number(r.profit_share_amount), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs text-muted">{t("totalDeducted")}</p>
        <p className="num text-lg font-semibold" dir="ltr">
          {money(totalDeducted)}
        </p>
      </div>

      {(rows ?? []).length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows!.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
              <div>
                <p className="font-medium">{nameById.get(r.provider_id) ?? "—"}</p>
                <p className="text-xs text-muted tabular-nums" dir="ltr">
                  {formatDate(r.period_end, locale)}
                </p>
              </div>
              <div className="text-end">
                <p className="num font-semibold text-danger" dir="ltr">
                  {money(-Number(r.profit_share_amount))}
                </p>
                <p className="text-xs text-muted">{t(`status_${r.status}`)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
