import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { LeaderCard } from "@/components/LeaderCard";

// Featured leaders for a customer's dashboard: same "worth following"
// criteria as the homepage's featured section (positive return, decent
// win rate, not stopped/archived), minus the international-roster
// restriction that's specific to the public marketing page. Traders the
// customer already copies are excluded -- this is meant to suggest new
// ones, not repeat their own active copies.
export async function SuggestedTraders({ excludeProviderIds }: { excludeProviderIds: string[] }) {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();

  // The settings risk questionnaire stores low/medium/high; provider_cards
  // risk_level uses the Arabic labels.
  const riskProfile = (await cookies()).get("risk_profile")?.value;
  const riskLevel = ({ low: "منخفضة", medium: "متوسطة", high: "مرتفعة" } as Record<string, string>)[riskProfile ?? ""];

  let query = supabase
    .from("provider_cards")
    .select("*")
    .eq("is_archived", false)
    .neq("trading_status", "stopped")
    .gt("roi_90d", 0)
    .gte("win_rate_all", 50);
  if (riskLevel) query = query.eq("risk_level", riskLevel);
  const { data: rawProviders } = await query
    .order("rating_score", { ascending: false, nullsFirst: false })
    .limit(8 + excludeProviderIds.length);

  const providers = (rawProviders ?? []).filter((p) => !excludeProviderIds.includes(p.provider_id)).slice(0, 8);
  if (providers.length === 0) return null;

  const sparkSeries: Record<string, number[]> = {};
  await Promise.all(
    providers.map(async (p) => {
      // Last 30 days of the leader's daily equity series.
      const { data } = await supabase.rpc("provider_daily_series", { p_provider_id: p.provider_id });
      const ret = ((data as { ret?: number[] } | null)?.ret ?? []).slice(-30);
      let index = 1;
      const series = [0];
      for (const r of ret) {
        index *= 1 + Number(r);
        series.push((index - 1) * 100);
      }
      sparkSeries[p.provider_id] = series;
    }),
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("suggestedTradersTitle")}</h2>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
        {providers.map((p) => (
          <div key={p.provider_id} className="w-64 shrink-0">
            <LeaderCard provider={p} copyHref={`/trader/${p.provider_id}#copy`} sparkline={sparkSeries[p.provider_id]} />
          </div>
        ))}
      </div>
    </section>
  );
}
