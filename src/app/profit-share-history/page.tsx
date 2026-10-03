import { getMoney } from "@/lib/money-server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";

// A new page for the copier dashboard (Phase 5): their own profit-share
// deductions/refunds across every trader they copy. Purely additive --
// nothing on the existing dashboard/portfolio pages changes.
export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("profitShareHistoryTitle"), description: t("profitShareHistoryDesc") };
}

export default async function ProfitShareHistoryPage() {
  const t = await getTranslations("LeadTrader.followerLedger");
  const money = await getMoney();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fprofit-share-history");

  const { data: rows } = await supabase
    .from("profit_share_ledger")
    .select("id, provider_id, period_start, period_end, gross_pnl, profit_share_pct, profit_share_amount, status")
    .eq("follower_id", user.id)
    .order("period_end", { ascending: false });

  const providerIds = Array.from(new Set((rows ?? []).map((r) => r.provider_id)));
  const { data: providers } = providerIds.length
    ? await supabase.from("providers").select("id, display_name").in("id", providerIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((providers ?? []).map((p) => [p.id, p.display_name]));

  const totalDeducted = (rows ?? []).filter((r) => r.status === "settled").reduce((sum, r) => sum + Number(r.profit_share_amount), 0);

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>
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
                    {new Date(r.period_end).toLocaleDateString("en-US")}
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
      </main>
    </>
  );
}
