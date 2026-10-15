import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TraderAvatar } from "@/components/TraderAvatar";
import { RiskBadge, StoppedBadge } from "@/components/TraderBadges";
import { Sparkline } from "@/components/Sparkline";
import { ConfirmButton } from "@/components/ConfirmButton";
import { periodStats, DEFAULT_PERIOD, type Period } from "@/lib/leader-period";
import { fmtDrawdown, fmtReturn, fmtWinRate } from "@/lib/format-stats";
import { adjustedMaxDrawdown } from "@/lib/leader-scores";

type ProviderCard = {
  provider_id: string;
  display_name: string;
  avatar_url: string | null;
  rating_score: number | null;
  tier: string | null;
  risk_level: string | null;
  trading_status: string | null;
  followers_count: number | null;
  min_copy_amount: number | null;
  [column: string]: unknown;
};

/** One size for every trader card in the platform (home, discover, markets, empty states, landing). */
export const LEADER_CARD_SIZE = "w-[17.5rem] h-[24rem]";

// The one trader card. Same size and the same order everywhere: picture and name, risk, the return
// of the period with its small curve, three key figures, and the copy button. The whole card opens
// the trader's profile.
export async function LeaderCard({
  provider: p,
  copyHref,
  sparkline,
  adjustedMdd,
  isWatching,
  onFollowAction,
  followFormField = "providerId",
  copyState = "copy",
  onStopCopyingAction,
  period = DEFAULT_PERIOD,
}: {
  provider: ProviderCard;
  copyHref: string;
  /** Cumulative return series in percent (provider_sparklines). */
  sparkline?: number[];
  /** Kept for callers that still pass it; the card shows the period's drawdown. */
  maxDrawdownPct?: number | null;
  /** Drawdown of the period including floating losses (leader_adjusted_drawdown). */
  adjustedMdd?: number | null;
  /** Kept for callers that still pass it; the card no longer shows a bio. */
  bio?: string | null;
  /** With a follow action (signed in), a small bookmark toggle sits in the header. */
  isWatching?: boolean;
  onFollowAction?: (formData: FormData) => void | Promise<void>;
  followFormField?: string;
  copyState?: "copy" | "stopCopying" | "stoppedDisabled" | "blockedDisabled";
  onStopCopyingAction?: (formData: FormData) => void | Promise<void>;
  period?: Period;
}) {
  const t = await getTranslations("Discover");
  const stats = periodStats(p, period);
  const isDown = stats.roi != null && stats.roi < 0;
  const hint = stats.sufficient ? undefined : t("insufficientData");
  const mdd = stats.sufficient ? adjustedMaxDrawdown(stats.mdd, adjustedMdd ?? null) : null;
  const periodLabel = t(`periodShort_${period}`);
  const isStopped = p.trading_status === "stopped";
  const button = "w-full rounded-lg px-3 py-2.5 text-center text-sm font-bold transition";

  return (
    <div className={`group relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-[20px] border border-white/[0.08] bg-surface p-4 transition hover:border-accent/30 ${LEADER_CARD_SIZE}`}>
      <Link href={`/trader/${p.provider_id}`} aria-label={p.display_name ?? ""} className="absolute inset-0 z-0" />

      <div className="flex items-start gap-2.5">
        <TraderAvatar providerId={p.provider_id} name={p.display_name} avatarUrl={p.avatar_url} ratingScore={p.rating_score} size={44} showLevel />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-base font-bold leading-snug">{p.display_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <RiskBadge level={p.risk_level} />
            <StoppedBadge stopped={isStopped} />
          </div>
        </div>
        {onFollowAction && (
          <form action={onFollowAction} className="relative z-10 shrink-0">
            <input type="hidden" name={followFormField} value={p.provider_id} />
            <button
              type="submit"
              aria-label={isWatching ? t("unfollow") : t("follow")}
              title={isWatching ? t("unfollow") : t("follow")}
              className={`tap-44 flex h-8 w-8 items-center justify-center rounded-full border transition ${
                isWatching ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted hover:border-accent/40 hover:text-accent"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill={isWatching ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </form>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div title={hint}>
          <p className={`text-2xl font-bold tabular-nums ${stats.roi == null ? "text-muted" : isDown ? "text-danger" : "text-success"}`}>
            <bdi dir="ltr">{fmtReturn(stats.roi)}</bdi>
          </p>
          <p className="text-xs text-muted">{t("roiLabel", { period: periodLabel })}</p>
        </div>
      </div>
      <div className="h-16">{sparkline && sparkline.length >= 3 ? <Sparkline values={sparkline} /> : null}</div>

      <dl className="grid grid-cols-3 gap-1 rounded-xl bg-background/60 px-1 py-2 text-center">
        <div title={hint}>
          <dd className="text-sm font-bold tabular-nums">
            <bdi dir="ltr">{fmtWinRate(stats.winRate)}</bdi>
          </dd>
          <dt className="text-xs text-muted">{t("winRate")}</dt>
        </div>
        <div className="border-x border-white/10" title={hint}>
          <dd className="text-sm font-bold tabular-nums">
            <bdi dir="ltr">{fmtDrawdown(mdd)}</bdi>
          </dd>
          <dt className="text-xs text-muted">{t("maxDrawdown")}</dt>
        </div>
        <div>
          <dd className="text-sm font-bold tabular-nums">{p.followers_count}</dd>
          <dt className="text-xs text-muted">{t("copiersLabel")}</dt>
        </div>
      </dl>

      <div className="relative z-10 mt-auto">
        {copyState === "stopCopying" && onStopCopyingAction ? (
          <form action={onStopCopyingAction}>
            <input type="hidden" name="providerId" value={p.provider_id} />
            <input type="hidden" name="returnTo" value="/discover" />
            <ConfirmButton confirmText={t("stopCopyingConfirm", { name: p.display_name })} className={`${button} border border-border hover:border-muted`}>
              {t("stopCopying")}
            </ConfirmButton>
          </form>
        ) : copyState === "stoppedDisabled" || copyState === "blockedDisabled" ? (
          <button
            type="button"
            disabled
            title={copyState === "stoppedDisabled" ? t("stoppedTooltip") : t("blockedTooltip")}
            className={`${button} cursor-not-allowed bg-border text-muted`}
          >
            {t("copy")}
          </button>
        ) : (
          <Link href={copyHref} className={`${button} block bg-accent text-accent-foreground hover:bg-accent-hover`}>
            {t("copy")}
          </Link>
        )}
      </div>
    </div>
  );
}
