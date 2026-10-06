import { nowMs } from "@/lib/now";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { TraderAvatar } from "@/components/TraderAvatar";

export async function MostCopiedThisWeek() {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();

  const weekAgo = new Date(nowMs() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSubs } = await supabase
    .from("subscriptions")
    .select("provider_id")
    .gte("copy_started_at", weekAgo);

  if (!recentSubs || recentSubs.length === 0) return null;

  const countByProvider = new Map<string, number>();
  for (const s of recentSubs) countByProvider.set(s.provider_id, (countByProvider.get(s.provider_id) ?? 0) + 1);

  const topProviderIds = Array.from(countByProvider.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);

  if (topProviderIds.length === 0) return null;

  const { data: providers } = await supabase
    .from("provider_cards")
    .select("provider_id, display_name, avatar_url, rating_score, win_rate_pct")
    .in("provider_id", topProviderIds);

  const ordered = topProviderIds
    .map((id) => (providers ?? []).find((p) => p.provider_id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  if (ordered.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("mostCopiedThisWeekTitle")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ordered.map((p) => (
          <Link
            key={p.provider_id}
            href={`/trader/${p.provider_id}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40 hover:shadow-lg"
          >
            <TraderAvatar providerId={p.provider_id} name={p.display_name} avatarUrl={p.avatar_url} ratingScore={p.rating_score} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.display_name}</p>
              <p className="text-xs text-muted">
                {t("copiersThisWeek", { count: countByProvider.get(p.provider_id) ?? 0 })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
