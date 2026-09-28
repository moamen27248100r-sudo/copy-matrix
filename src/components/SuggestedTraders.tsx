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

  const { data: rawProviders } = await supabase
    .from("provider_cards")
    .select("*")
    .eq("is_archived", false)
    .neq("trading_status", "stopped")
    .gt("avg_daily_return_pct", 0)
    .gte("win_rate_pct", 60)
    .order("rating_score", { ascending: false, nullsFirst: false })
    .limit(8 + excludeProviderIds.length);

  const providers = (rawProviders ?? []).filter((p) => !excludeProviderIds.includes(p.provider_id)).slice(0, 8);
  if (providers.length === 0) return null;

  const sparkSeries: Record<string, number[]> = {};
  await Promise.all(
    providers.map(async (p) => {
      const { data: rows } = await supabase
        .from("signals")
        .select("side, entry_price, exit_price, closed_at")
        .eq("provider_id", p.provider_id)
        .eq("status", "closed")
        .eq("created_by_admin", false)
        .not("exit_price", "is", null)
        .order("closed_at", { ascending: false })
        .limit(40);
      let cumulative = 0;
      const series = [0];
      for (const r of (rows ?? []).reverse()) {
        const raw = (Number(r.exit_price) - Number(r.entry_price)) / Number(r.entry_price);
        cumulative += (r.side === "sell" ? -raw : raw) * 100;
        series.push(cumulative);
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
