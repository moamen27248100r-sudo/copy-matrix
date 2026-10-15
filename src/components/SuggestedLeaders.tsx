import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { TraderAvatar } from "@/components/TraderAvatar";
import { RiskBadge } from "@/components/TraderBadges";
import { fmtReturn } from "@/lib/format-stats";

// A short row of suggested leaders for empty screens and the home page: low or medium risk only,
// enough closed trades in the last 30 days for the figure to mean something, a positive 30-day
// return, ranked by that return. Leaders the customer already copies are left out. When the
// customer answered the risk questions with "low", only low-risk leaders are suggested.
export async function SuggestedLeaders({
  excludeProviderIds = [],
  limit = 3,
  title,
}: {
  excludeProviderIds?: string[];
  limit?: number;
  title?: string;
}) {
  const t = await getTranslations("Discover");
  const td = await getTranslations("Dashboard");
  const supabase = await createClient();
  const riskProfile = (await cookies()).get("risk_profile")?.value;
  const levels = riskProfile === "low" ? ["منخفضة"] : ["منخفضة", "متوسطة"];

  const { data } = await supabase
    .from("provider_cards")
    .select("provider_id, display_name, avatar_url, rating_score, risk_level, roi_30d, followers_count")
    .eq("is_archived", false)
    .neq("trading_status", "stopped")
    .in("risk_level", levels)
    .gt("roi_30d", 0)
    .gte("trades_30d", 20)
    .order("roi_30d", { ascending: false })
    .limit(limit + excludeProviderIds.length);

  const leaders = (data ?? []).filter((p) => !excludeProviderIds.includes(String(p.provider_id))).slice(0, limit);
  if (leaders.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section-title">{title ?? td("suggestedTradersTitle")}</h2>
        <Link href="/discover" className="text-sm font-medium text-accent-text hover:underline">
          {td("favoritesViewAll")}
        </Link>
      </div>
      <ul className="no-scrollbar -mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {leaders.map((p) => (
          <li key={p.provider_id} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <div className="flex h-full flex-col gap-4 rounded-[20px] border border-border bg-surface p-5">
              <Link href={`/trader/${p.provider_id}`} className="flex min-w-0 items-center gap-3">
                <TraderAvatar
                  providerId={String(p.provider_id)}
                  name={p.display_name}
                  avatarUrl={p.avatar_url}
                  ratingScore={p.rating_score}
                  size={44}
                />
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold">{p.display_name}</span>
                  <span className="mt-1 block">
                    <RiskBadge level={p.risk_level} />
                  </span>
                </span>
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xl font-bold text-success">
                    <bdi>{fmtReturn(Number(p.roi_30d))}</bdi>
                  </p>
                  <p className="text-xs text-muted">{t("roiLabel", { period: t("periodShort_30") })}</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{p.followers_count}</p>
                  <p className="text-xs text-muted">{t("copiersLabel")}</p>
                </div>
              </div>
              <Link
                href={`/trader/${p.provider_id}#copy`}
                className="mt-auto rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-bold text-accent-foreground transition hover:bg-accent-hover"
              >
                {t("copy")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
