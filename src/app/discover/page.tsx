import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { unfollowProvider, followTrader, unfollowTrader } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";
import { TierBadge, RiskBadge, StoppedBadge } from "@/components/TraderBadges";
import { TraderAvatar } from "@/components/TraderAvatar";
import { getBioTranslator } from "@/lib/bio-translations";

const SORT_OPTIONS = {
  best: { column: "rating_score", ascending: false, labelKey: "sortBest" },
  return: { column: "avg_daily_return_pct", ascending: false, labelKey: "sortReturn" },
  winrate: { column: "win_rate_pct", ascending: false, labelKey: "sortWinrate" },
  followers: { column: "followers_count", ascending: false, labelKey: "sortFollowers" },
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

// Deterministic per-leader "trend" line for the card's mini sparkline --
// seeded by provider id (stable across renders) and biased by their real
// avg_daily_return_pct sign/magnitude, so it visually leans up for a
// leader who's actually up and down for one who's actually down. Purely
// decorative (the real equity curve is on the full profile page); no
// extra query needed since it only uses data already fetched per card.
function sparklinePoints(seed: string, biasPct: number | null): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return (h % 1000) / 1000;
  };
  const bias = biasPct != null ? Math.max(-1, Math.min(1, biasPct / 2)) : 0;
  const values = [50];
  for (let i = 1; i < 14; i++) {
    const next = values[i - 1] + bias * 2.5 + (rand() - 0.5) * 14;
    values.push(Math.max(8, Math.min(92, next)));
  }
  return values.map((v, i) => `${(i / (values.length - 1)) * 100},${40 - (v / 100) * 40}`).join(" ");
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; error?: string }>;
}) {
  const { q, sort, error } = await searchParams;
  const sortKey: SortKey = sort && sort in SORT_OPTIONS ? (sort as SortKey) : "best";
  const t = await getTranslations("Discover");
  const translateBio = await getBioTranslator();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let providersQuery = supabase.from("provider_cards").select("*");
  if (q) {
    providersQuery = providersQuery.ilike("display_name", `%${q}%`);
  }
  const { column, ascending } = SORT_OPTIONS[sortKey];
  providersQuery = providersQuery.order(column, { ascending, nullsFirst: false });

  const [{ data: rawProviders }, { data: mySubscriptions }, { data: myFollows }] = await Promise.all([
    providersQuery,
    user
      ? supabase
          .from("subscriptions")
          .select("provider_id")
          .eq("follower_id", user.id)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { provider_id: string }[] }),
    user
      ? supabase.from("follows").select("provider_id").eq("follower_id", user.id)
      : Promise.resolve({ data: [] as { provider_id: string }[] }),
  ]);

  const providers = rawProviders;

  const followingIds = new Set(
    (mySubscriptions ?? []).map((s) => s.provider_id),
  );
  const followingProviderId = (mySubscriptions ?? [])[0]?.provider_id ?? null;
  const watchingIds = new Set((myFollows ?? []).map((f) => f.provider_id));

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <BackButton fallbackHref="/dashboard" />
        <h1 className="text-2xl font-semibold">{t("title")}</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("searchPlaceholder")}
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm"
        />
        <input type="hidden" name="sort" value={sortKey} />
        <button type="submit" className="rounded bg-foreground px-4 py-2 text-sm text-background">
          {t("searchButton")}
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-1.5">
        {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => {
          const isActive = key === sortKey;
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          params.set("sort", key);
          return (
            <Link
              key={key}
              href={`/discover?${params.toString()}`}
              className={
                isActive
                  ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                  : "rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-background hover:text-foreground"
              }
            >
              {t(SORT_OPTIONS[key].labelKey)}
            </Link>
          );
        })}
      </div>

      {!providers || providers.length === 0 ? (
        <p className="text-sm text-muted">
          {t("noMatches")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {providers.map((p) => {
            const isFollowing = followingIds.has(p.provider_id);
            const isBlocked = followingProviderId != null && !isFollowing;
            const isStopped = p.trading_status === "stopped";
            const isWatching = watchingIds.has(p.provider_id);
            const copyHref = user
              ? `/trader/${p.provider_id}#copy`
              : `/signup?next=${encodeURIComponent(`/trader/${p.provider_id}#copy`)}`;
            const isDown = p.avg_daily_return_pct != null && p.avg_daily_return_pct < 0;
            const points = sparklinePoints(p.provider_id, p.avg_daily_return_pct);
            return (
              <div
                key={p.provider_id}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-surface p-4 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/10"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/[0.07] to-transparent" />

                <div className="relative flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-1 rounded-full bg-accent/25 opacity-60 blur-md transition-opacity group-hover:opacity-90" />
                    <TraderAvatar
                      providerId={p.provider_id}
                      name={p.display_name}
                      avatarUrl={p.avatar_url}
                      ratingScore={p.rating_score}
                      size={48}
                      showLevel
                      className="relative ring-2 ring-white/10"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/trader/${p.provider_id}`} className="min-w-0 truncate text-base font-semibold tracking-tight underline-offset-2 hover:underline">
                        {p.display_name}
                      </Link>
                      <form action={isWatching ? unfollowTrader : followTrader}>
                        <input type="hidden" name="providerId" value={p.provider_id} />
                        <button
                          type="submit"
                          className={
                            isWatching
                              ? "rounded-full border border-border px-2 py-0.5 text-[11px] text-muted transition hover:border-muted hover:text-foreground"
                              : "rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent transition hover:bg-accent/15"
                          }
                        >
                          {isWatching ? t("unfollow") : t("follow")}
                        </button>
                      </form>
                    </div>
                    <span className="mt-0.5 inline-flex items-center rounded-full bg-background px-1.5 py-0.5 text-xs text-muted">
                      {t("copiersCount", { count: p.followers_count })}
                    </span>
                  </div>
                </div>

                <p className="relative line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-muted">
                  {p.bio ? translateBio(p.bio) : " "}
                </p>

                <div className="relative flex flex-wrap gap-1.5">
                  <TierBadge tier={p.tier} />
                  <RiskBadge level={p.risk_level} />
                  <StoppedBadge stopped={isStopped} />
                </div>

                <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-background/70">
                  <svg
                    viewBox="0 0 100 40"
                    preserveAspectRatio="none"
                    className={`absolute inset-x-0 bottom-0 h-full w-full ${isDown ? "text-danger/15" : "text-success/15"}`}
                    aria-hidden="true"
                  >
                    <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="relative grid grid-cols-3 p-2.5 text-center text-sm">
                    <div className="border-e border-white/10">
                      <p className="font-semibold text-success">
                        {p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}
                      </p>
                      <p className="text-[11px] text-muted">{t("winRate")}</p>
                    </div>
                    <div className="border-e border-white/10">
                      <p className={isDown ? "font-semibold text-danger" : "font-semibold text-success"}>
                        {p.avg_daily_return_pct != null ? `${p.avg_daily_return_pct}%` : "—"}
                      </p>
                      <p className="text-[11px] text-muted">{t("avgDailyReturn")}</p>
                    </div>
                    <div>
                      <p className="font-semibold">{p.closed_signals}</p>
                      <p className="text-[11px] text-muted">{t("closedTrades")}</p>
                    </div>
                  </div>
                </div>

                <p className="relative text-center text-xs text-muted">
                  {t("minCopyAmount", { amount: `$${Number(p.min_copy_amount).toLocaleString("en-US")}` })}
                </p>

                <div className="relative flex flex-col gap-2">
                  <Link
                    href={`/trader/${p.provider_id}`}
                    className="rounded-lg border border-border bg-transparent px-3 py-2.5 text-center text-sm font-medium text-foreground transition hover:border-accent/50 hover:bg-accent/5"
                  >
                    {t("viewProfile")}
                  </Link>
                  {isFollowing ? (
                    <form action={unfollowProvider}>
                      <input type="hidden" name="providerId" value={p.provider_id} />
                      <input type="hidden" name="returnTo" value="/discover" />
                      <button type="submit" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm transition hover:border-muted">
                        {t("stopCopying")}
                      </button>
                    </form>
                  ) : isStopped ? (
                    <button
                      type="button"
                      disabled
                      title={t("stoppedTooltip")}
                      className="w-full cursor-not-allowed rounded-lg bg-border px-3 py-2.5 text-sm font-medium text-muted"
                    >
                      {t("copy")}
                    </button>
                  ) : isBlocked ? (
                    <button
                      type="button"
                      disabled
                      title={t("blockedTooltip")}
                      className="w-full cursor-not-allowed rounded-lg bg-border px-3 py-2.5 text-sm font-medium text-muted"
                    >
                      {t("copy")}
                    </button>
                  ) : (
                    <Link
                      href={copyHref}
                      className="w-full rounded-lg bg-gradient-to-r from-accent to-success px-3 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-accent/20 transition hover:shadow-lg hover:shadow-accent/30 hover:brightness-110"
                    >
                      {t("copy")}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </main>
    </>
  );
}
