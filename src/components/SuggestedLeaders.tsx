import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LeaderCard } from "@/components/LeaderCard";
import { getSparklines } from "@/lib/sparklines";

// A short row of suggested traders for empty screens: low or medium risk only, enough closed trades
// in the last 30 days for the figure to mean something, a positive 30-day return, ranked by that
// return. Traders the customer already copies are left out. When the customer answered the risk
// questions with "low", only low-risk traders are suggested. Same card as everywhere else.
export async function SuggestedLeaders({
  excludeProviderIds = [],
  limit = 3,
  title,
}: {
  excludeProviderIds?: string[];
  limit?: number;
  title?: string;
}) {
  const td = await getTranslations("Dashboard");
  const supabase = await createClient();
  const riskProfile = (await cookies()).get("risk_profile")?.value;
  const levels = riskProfile === "low" ? ["منخفضة"] : ["منخفضة", "متوسطة"];

  const { data } = await supabase
    .from("provider_cards")
    .select("*")
    .eq("is_archived", false)
    .neq("trading_status", "stopped")
    .in("risk_level", levels)
    .gt("roi_30d", 0)
    .gte("trades_30d", 20)
    .order("roi_30d", { ascending: false })
    .limit(limit + excludeProviderIds.length);

  const leaders = (data ?? []).filter((p) => !excludeProviderIds.includes(String(p.provider_id))).slice(0, limit);
  if (leaders.length === 0) return null;
  const spark = await getSparklines(supabase, leaders.map((p) => String(p.provider_id)));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section-title">{title ?? td("suggestedTradersTitle")}</h2>
        <Link href="/discover" className="text-sm font-medium text-accent-text hover:underline">
          {td("favoritesViewAll")}
        </Link>
      </div>
      <div className="no-scrollbar -mx-6 flex gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
        {leaders.map((p) => (
          <LeaderCard key={p.provider_id} provider={p} copyHref={`/trader/${p.provider_id}#copy`} sparkline={spark[String(p.provider_id)]} />
        ))}
      </div>
    </section>
  );
}
