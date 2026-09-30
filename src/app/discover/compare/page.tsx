import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { fetchProviderStats } from "@/lib/provider-stats";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("discoverCompareTitle"), description: t("discoverCompareDesc") };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter(Boolean).slice(0, 4);
  if (idList.length < 2) redirect("/discover");

  const t = await getTranslations("Discover");
  const supabase = await createClient();
  const { data: providers } = await supabase
    .from("provider_cards")
    .select("provider_id, display_name, win_rate_pct, avg_daily_return_pct, followers_count, min_copy_amount, risk_level")
    .in("provider_id", idList);
  const list = idList.map((id) => providers?.find((p) => p.provider_id === id)).filter((p) => !!p);
  const stats = await fetchProviderStats(
    supabase,
    list.map((p) => p.provider_id),
  );

  const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
  const rows: { label: string; value: (p: (typeof list)[number]) => string }[] = [
    { label: t("avgDailyReturn"), value: (p) => pct(p.avg_daily_return_pct) },
    { label: t("winRate"), value: (p) => pct(p.win_rate_pct) },
    { label: t("compareTotalReturn"), value: (p) => pct(stats.get(p.provider_id)?.totalReturn) },
    { label: t("compareMaxDrawdown"), value: (p) => pct(stats.get(p.provider_id)?.maxDrawdown) },
    { label: t("compareSharpe"), value: (p) => String(stats.get(p.provider_id)?.sharpe ?? "—") },
    { label: t("compareTrades"), value: (p) => String(stats.get(p.provider_id)?.trades ?? 0) },
    { label: t("copiersLabel"), value: (p) => String(p.followers_count) },
    { label: t("minCopyAmountLabel"), value: (p) => `$${Number(p.min_copy_amount).toLocaleString("en-US")}` },
  ];

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-page-title">{t("compareTitle")}</h1>
          <Link href="/discover" className="text-sm text-accent hover:underline">
            {t("compareBack")}
          </Link>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[520px] border-collapse text-start">
            <thead>
              <tr className="border-b border-border bg-surface text-xs">
                <th className="px-4 py-3" />
                {list.map((p) => (
                  <th key={p.provider_id} className="px-4 py-3 text-start font-semibold">
                    <Link href={`/trader/${p.provider_id}`} className="hover:text-accent">
                      {p.display_name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-xs text-muted">{r.label}</td>
                  {list.map((p) => (
                    <td key={p.provider_id} className="px-4 py-3 text-sm tabular-nums" dir="ltr">
                      {r.value(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
