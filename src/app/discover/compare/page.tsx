import { getMoney } from "@/lib/money-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { parsePeriod, periodStats } from "@/lib/leader-period";
import { aumBandFloor } from "@/lib/aum-band";
import { fmtReturn, ltrIsolate } from "@/lib/format-stats";
import { adjustedMaxDrawdown } from "@/lib/leader-scores";
import { adjustedDrawdowns } from "@/lib/leader-drawdown";
import { RiskBadge } from "@/components/TraderBadges";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("discoverCompareTitle"), description: t("discoverCompareDesc") };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; period?: string }> }) {
  const { ids, period: periodParam } = await searchParams;
  const period = parsePeriod(periodParam);
  const idList = (ids ?? "").split(",").filter(Boolean).slice(0, 4);
  if (idList.length < 2) redirect("/discover");

  const t = await getTranslations("Discover");
  const money = await getMoney();
  const supabase = await createClient();
  const { data: providers } = await supabase.from("provider_cards").select("*").in("provider_id", idList);
  const list = idList.map((id) => providers?.find((p) => p.provider_id === id)).filter((p) => !!p);
  const adjustedDd = await adjustedDrawdowns(supabase, list.map((p) => String(p.provider_id)), period);
  const notEnough = t("insufficientData");

  const pct = (v: number | null | undefined, signed = false) => (v == null ? "—" : signed ? fmtReturn(v) : `${v.toFixed(2)}%`);
  const periodLabel = t(`periodShort_${period}`);
  const rows: { label: string; value: (p: (typeof list)[number]) => string }[] = [
    { label: t("roiLabel", { period: periodLabel }), value: (p) => pct(periodStats(p, period).roi, true) },
    { label: t("winRate"), value: (p) => pct(periodStats(p, period).winRate) },
    { label: t("compareMaxDrawdown"), value: (p) => { const s = periodStats(p, period); return s.sufficient ? pct(adjustedMaxDrawdown(s.mdd, adjustedDd.get(String(p.provider_id)) ?? null)) : "—"; } },
    { label: t("compareSharpe"), value: (p) => String(periodStats(p, period).sharpe ?? "—") },
    { label: t("compareTrades"), value: (p) => { const s = periodStats(p, period); return `${s.trades ?? 0}${s.sufficient ? "" : " ⓘ"}`; } },
    { label: t("compareTotalReturn"), value: (p) => pct(p.roi_all != null ? Number(p.roi_all) : null, true) },
    { label: t("copiersLabel"), value: (p) => String(p.followers_count) },
    { label: t("aumLabel"), value: (p) => (aumBandFloor(p.aum_band) != null ? t("aumOver", { amount: ltrIsolate(money(aumBandFloor(p.aum_band) as number, { compact: true })) }) : "—") },
    { label: t("profitShareLabel"), value: (p) => (p.profit_share_pct != null ? `${Number(p.profit_share_pct)}%` : "—") },
    { label: t("minCopyAmountLabel"), value: (p) => money(Number(p.min_copy_amount)) },
  ];

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6">
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
                  <th key={p.provider_id} className="px-4 py-3 text-start font-bold">
                    <Link href={`/trader/${p.provider_id}`} className="hover:text-accent">
                      {p.display_name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* The same badge as on the cards and the profile (provider_stats.risk_level, migration 0265). */}
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-xs text-muted">{t("filterRisk")}</td>
                {list.map((p) => (
                  <td key={p.provider_id} className="px-4 py-3">
                    <RiskBadge level={p.risk_level} />
                  </td>
                ))}
              </tr>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-xs text-muted">{r.label}</td>
                  {list.map((p) => (
                    <td key={p.provider_id} className="px-4 py-3 text-sm tabular-nums" dir="ltr">
                      <bdi>{r.value(p)}</bdi>
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
