import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TraderAvatar } from "@/components/TraderAvatar";
import { TierBadge, RiskBadge, StoppedBadge } from "@/components/TraderBadges";
import { Sparkline } from "@/components/Sparkline";

type ProviderCard = {
  provider_id: string;
  display_name: string;
  avatar_url: string | null;
  rating_score: number | null;
  tier: string | null;
  risk_level: string | null;
  trading_status: string | null;
  win_rate_pct: number | null;
  avg_daily_return_pct: number | null;
  followers_count: number | null;
  min_copy_amount: number | null;
};

// One card, used by both the homepage's featured-leaders section and the
// full discover grid -- a single shared component so a future visual
// change only has to happen once. Everything beyond the always-shown
// core (avatar, name, badges, stats, min-copy, primary/secondary CTAs)
// is opt-in via props so each page only pays for what it actually needs
// (homepage's bio/sparkline; discover's follow toggle and copy-state).
export async function LeaderCard({
  provider: p,
  copyHref,
  bio,
  sparkline,
  isWatching,
  onFollowAction,
  followFormField = "providerId",
  copyState = "copy",
  onStopCopyingAction,
}: {
  provider: ProviderCard;
  copyHref: string;
  bio?: string | null;
  sparkline?: number[];
  /** When provided (i.e. the viewer is logged in), renders a small
   * bookmark-icon follow toggle in the header instead of a full text
   * pill -- keeps the header uncluttered. */
  isWatching?: boolean;
  onFollowAction?: (formData: FormData) => void | Promise<void>;
  followFormField?: string;
  /** "copy" (default primary CTA), "stopCopying" (already copying this
   * leader), "stoppedDisabled" / "blockedDisabled" (copy button disabled
   * with an explanatory tooltip). */
  copyState?: "copy" | "stopCopying" | "stoppedDisabled" | "blockedDisabled";
  onStopCopyingAction?: (formData: FormData) => void | Promise<void>;
}) {
  const t = await getTranslations("Discover");
  const isDown = p.avg_daily_return_pct != null && p.avg_daily_return_pct < 0;
  const isStopped = p.trading_status === "stopped";

  return (
    <div className="group relative flex h-full min-h-[21rem] flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/70 p-4 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/[0.07] to-transparent" />

      <Link href={`/trader/${p.provider_id}`} aria-label={p.display_name ?? ""} className="absolute inset-0 z-0" />

      {/* Header: avatar fixed at the start, name + a soft sub-header row
          of badges underneath it (never sharing the name's own line), a
          bookmark-style follow toggle pinned to the far end. */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <TraderAvatar
            providerId={p.provider_id}
            name={p.display_name}
            avatarUrl={p.avatar_url}
            ratingScore={p.rating_score}
            size={48}
            showLevel
          />
          <div className="min-w-0">
            <p className="min-w-0 truncate text-base font-semibold tracking-tight">{p.display_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TierBadge tier={p.tier} />
              <RiskBadge level={p.risk_level} />
              <StoppedBadge stopped={isStopped} />
            </div>
          </div>
        </div>

        {onFollowAction && (
          <form action={onFollowAction} className="relative z-10 shrink-0">
            <input type="hidden" name={followFormField} value={p.provider_id} />
            <button
              type="submit"
              aria-label={isWatching ? t("unfollow") : t("follow")}
              title={isWatching ? t("unfollow") : t("follow")}
              className={
                isWatching
                  ? "flex h-8 w-8 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent transition hover:bg-accent/15"
                  : "flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition hover:border-accent/40 hover:text-accent"
              }
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isWatching ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </form>
        )}
      </div>

      {sparkline && sparkline.length >= 3 && (
        <div className="relative z-10 rounded-xl border border-white/5 bg-black/20 p-3">
          <div className="flex items-center justify-end text-[11px] text-muted">
            <span dir="ltr" className={`font-semibold ${sparkline[sparkline.length - 1] >= 0 ? "text-success" : "text-danger"}`}>
              {sparkline[sparkline.length - 1] >= 0 ? "+" : ""}
              {sparkline[sparkline.length - 1].toFixed(1)}%
            </span>
          </div>
          <Sparkline
            id={`spark-${p.provider_id}`}
            values={sparkline}
            className={`mt-2 h-14 w-full ${sparkline[sparkline.length - 1] >= 0 ? "text-success" : "text-danger"}`}
          />
        </div>
      )}
      {bio && <p className="relative z-10 line-clamp-2 text-xs leading-relaxed text-muted">{bio}</p>}

      {/* Stats grid: identical three-way center-aligned layout on every
          card, standardized padding/typography (value weight/size and a
          lighter muted label underneath). */}
      <div className="flex items-center overflow-hidden rounded-xl border border-white/[0.06] bg-background/60">
        <div className="flex-1 border-e border-white/10 px-2 py-2.5 text-center">
          <p className="text-sm font-semibold text-success">{p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}</p>
          <p className="text-[11px] font-normal text-muted">{t("winRate")}</p>
        </div>
        <div className="flex-1 border-e border-white/10 px-2 py-2.5 text-center">
          <p className={isDown ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-success"}>
            {p.avg_daily_return_pct != null ? `${p.avg_daily_return_pct}%` : "—"}
          </p>
          <p className="text-[11px] font-normal text-muted">{t("avgDailyReturn")}</p>
        </div>
        <div className="flex-1 px-2 py-2.5 text-center">
          <p className="text-sm font-semibold">{p.followers_count}</p>
          <p className="text-[11px] font-normal text-muted">{t("copiersLabel")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {t("minCopyAmountLabel")} <span dir="ltr">${Number(p.min_copy_amount).toLocaleString("en-US")}</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {/* CTAs: "نسخ" is always the prominent, rounded primary button at
          the very bottom; "عرض الملف الشخصي" is a quieter secondary
          ghost button directly above it (the whole card is already a
          click-through to the profile too, via the stretched Link). */}
      <div className="relative z-10 mt-auto flex flex-col gap-2">
        <Link
          href={`/trader/${p.provider_id}`}
          className="rounded-lg border border-border bg-transparent px-3 py-2.5 text-center text-sm font-medium text-foreground transition hover:border-accent/50 hover:bg-accent/5"
        >
          {t("viewProfile")}
        </Link>
        {copyState === "stopCopying" && onStopCopyingAction ? (
          <form action={onStopCopyingAction}>
            <input type="hidden" name="providerId" value={p.provider_id} />
            <input type="hidden" name="returnTo" value="/discover" />
            <button type="submit" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm transition hover:border-muted">
              {t("stopCopying")}
            </button>
          </form>
        ) : copyState === "stoppedDisabled" ? (
          <button type="button" disabled title={t("stoppedTooltip")} className="w-full cursor-not-allowed rounded-lg bg-border px-3 py-2.5 text-sm font-medium text-muted">
            {t("copy")}
          </button>
        ) : copyState === "blockedDisabled" ? (
          <button type="button" disabled title={t("blockedTooltip")} className="w-full cursor-not-allowed rounded-lg bg-border px-3 py-2.5 text-sm font-medium text-muted">
            {t("copy")}
          </button>
        ) : (
          <Link
            href={copyHref}
            className="w-full rounded-lg bg-accent px-3 py-3 text-center text-sm font-semibold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover"
          >
            {t("copy")}
          </Link>
        )}
      </div>
    </div>
  );
}
