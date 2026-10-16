import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { FeaturedLeader } from "@/components/FeaturedLeaders";
import { FeaturedLeadersLazy } from "@/components/FeaturedLeadersLazy";
import { getBioTranslator } from "@/lib/bio-translations";
import { MIN_CLOSED_TRADES } from "@/lib/leader-scores";

const SHOWN = 10;

// Suggested traders for the home page and the landing page: low or medium risk, a record of at least
// 12 months with enough recent trades, and a positive return over those 12 months -- ranked by the
// platform's own rating, so the list is not simply "whoever made the most". The leaders the customer
// already copies are left out. Hides itself when none qualify.
export async function loadFeaturedLeaders(excludeProviderIds: string[] = []): Promise<FeaturedLeader[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("provider_cards")
    .select("provider_id, display_name, avatar_url, bio, followers_count, rating_score")
    .eq("is_archived", false)
    .neq("trading_status", "stopped")
    .in("risk_level", ["منخفضة", "متوسطة"])
    .gte("track_days", 365)
    .gt("roi_90d", 0)
    .gte("trades_90d", MIN_CLOSED_TRADES)
    .order("rating_score", { ascending: false, nullsFirst: false })
    .limit(40);
  const candidates = (data ?? []).filter((p) => !excludeProviderIds.includes(String(p.provider_id)));
  if (candidates.length === 0) return [];

  const { data: rois } = await supabase.rpc("provider_roi_period", { p_ids: candidates.map((p) => p.provider_id), p_days: 365 });
  const roiById = new Map<string, number>((rois ?? []).map((r: { provider_id: string; roi: number | string }) => [r.provider_id, Number(r.roi)] as [string, number]));
  const translateBio = await getBioTranslator();

  return candidates
    .filter((p) => (roiById.get(p.provider_id) ?? 0) > 0)
    .slice(0, SHOWN)
    .map((p) => ({
      id: String(p.provider_id),
      name: p.display_name ?? "",
      photoUrl: p.avatar_url && !String(p.avatar_url).startsWith("/api/avatar/") ? String(p.avatar_url) : null,
      bio: translateBio(p.bio) ?? "",
      roi12: roiById.get(p.provider_id) as number,
      copiers: Number(p.followers_count ?? 0),
    }));
}

export async function FeaturedLeadersSection({ excludeProviderIds = [], viewAllHref = "/discover" }: { excludeProviderIds?: string[]; viewAllHref?: string }) {
  const t = await getTranslations("Featured");
  const leaders = await loadFeaturedLeaders(excludeProviderIds);
  if (leaders.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section-title">{t("title")}</h2>
        <Link href={viewAllHref} className="text-sm font-medium text-accent-text hover:underline">
          {t("viewAll")}
        </Link>
      </div>
      <FeaturedLeadersLazy leaders={leaders} />
    </section>
  );
}
