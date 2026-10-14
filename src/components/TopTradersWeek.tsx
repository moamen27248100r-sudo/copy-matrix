import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LeaderCard } from "@/components/LeaderCard";
import { MIN_CLOSED_TRADES } from "@/lib/leader-scores";

// "Top traders this week": ranked by the real return of the last 7 days, and only leaders with
// enough closed trades in that week (the same minimum sample as everywhere else), not archived and
// still trading. Leaders the customer already copies are left out. Hides itself when none qualify.
export async function TopTradersWeek({ excludeProviderIds }: { excludeProviderIds: string[] }) {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();

  const { data } = await supabase
    .from("provider_cards")
    .select("*")
    .eq("is_archived", false)
    .neq("trading_status", "stopped")
    .gt("roi_7d", 0)
    .gte("trades_7d", MIN_CLOSED_TRADES)
    .order("roi_7d", { ascending: false })
    .limit(6 + excludeProviderIds.length);

  const providers = (data ?? []).filter((p) => !excludeProviderIds.includes(p.provider_id)).slice(0, 6);
  if (providers.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("topTradersWeekTitle")}</h2>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
        {providers.map((p) => (
          <div key={p.provider_id} className="w-64 shrink-0">
            <LeaderCard provider={p} copyHref={`/trader/${p.provider_id}#copy`} period="7" />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">{t("topTradersWeekNote")}</p>
    </section>
  );
}
