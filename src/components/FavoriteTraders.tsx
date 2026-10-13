import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { TraderAvatar } from "@/components/TraderAvatar";
import { fmtReturn, fmtWinRate } from "@/lib/format-stats";

type Card = {
  provider_id: string;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number | null;
  win_rate_pct: number | null;
  roi_30d: number | null;
};

// The traders the customer bookmarked in Discover, with a quick look at how they are doing.
export async function FavoriteTraders({ userId }: { userId: string }) {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();
  const { data: follows } = await supabase.from("follows").select("provider_id").eq("follower_id", userId);
  const ids = (follows ?? []).map((r) => r.provider_id);
  if (ids.length === 0) return null;
  const { data } = await supabase
    .from("provider_cards")
    .select("provider_id, display_name, avatar_url, rating_score, win_rate_pct, roi_30d")
    .in("provider_id", ids)
    .order("rating_score", { ascending: false, nullsFirst: false })
    .limit(4);
  const cards = (data ?? []) as Card[];
  if (cards.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("favoritesTitle")}</h2>
        <Link href="/discover?favorites=1" className="text-sm text-accent hover:underline">
          {t("favoritesViewAll")}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const roi = c.roi_30d == null ? null : Number(c.roi_30d);
          return (
            <Link
              key={c.provider_id}
              href={`/trader/${c.provider_id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40"
            >
              <TraderAvatar providerId={c.provider_id} name={c.display_name ?? ""} avatarUrl={c.avatar_url} ratingScore={c.rating_score} size={40} />
              <div className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-medium">{c.display_name}</p>
                <p className="text-xs text-muted">
                  {t("favoritesWinRate")} <span dir="ltr" className="inline-block text-foreground">{fmtWinRate(c.win_rate_pct == null ? null : Number(c.win_rate_pct))}</span>
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p dir="ltr" className={`text-sm font-semibold ${roi != null && roi > 0 ? "text-success" : roi != null && roi < 0 ? "text-danger" : ""}`}>
                  {fmtReturn(roi)}
                </p>
                <p className="text-[11px] text-muted">{t("favoritesRoi30")}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
