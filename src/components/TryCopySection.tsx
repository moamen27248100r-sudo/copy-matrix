import Link from "next/link";
import { TraderAvatar } from "@/components/TraderAvatar";

export type TryCopyLeader = {
  id: string;
  name: string;
  avatarUrl: string | null;
  ratingScore: number | null;
  returnPct: number;
};

type Props = {
  title: string;
  description: string;
  cta: string;
  ctaHref: string;
  badgeLabel: string;
  cardWelcome: string;
  cardPortfolioLabel: string;
  cardTopLabel: string;
  liveLabel: string;
  portfolioValue: number;
  leaders: TryCopyLeader[];
};

function GraduationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
      <path d="M22 10v6" />
    </svg>
  );
}

// Marketing highlight: copy-trading demo pitch on the left/right pair of
// columns (text vs. live-data mockup card). Pure presentational -- every
// number in the card comes from props so the caller can feed it real
// platform data (real demo balance, real top-return leaders).
export function TryCopySection({
  title,
  description,
  cta,
  ctaHref,
  badgeLabel,
  cardWelcome,
  cardPortfolioLabel,
  cardTopLabel,
  liveLabel,
  portfolioValue,
  leaders,
}: Props) {
  const maxReturn = Math.max(...leaders.map((l) => l.returnPct), 0.01);

  return (
    <section className="border-y border-border bg-surface/30 px-6 py-16 sm:py-20">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:justify-between lg:gap-16">
        <div className="flex max-w-lg flex-1 flex-col items-start gap-5 text-start">
          <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            {badgeLabel}
          </span>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{title}</h2>
          <p className="leading-relaxed text-muted">{description}</p>
          <Link
            href={ctaHref}
            className="rounded-lg bg-accent px-7 py-3 font-medium text-accent-foreground shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 hover:bg-accent-hover"
          >
            {cta}
          </Link>
        </div>

        <div className="relative w-full max-w-sm shrink-0 sm:max-w-md lg:w-[26rem]">
          <div className="absolute -top-5 -end-3 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-success text-background shadow-xl shadow-success/30 sm:-end-5 sm:h-16 sm:w-16">
            <GraduationIcon />
          </div>

          <div className="try-copy-float rounded-3xl border border-border bg-background p-5 shadow-2xl shadow-black/40 transition duration-300 hover:border-accent/40 sm:p-6">
            <p className="text-sm font-semibold">{cardWelcome}</p>
            <p className="mt-3 text-xs text-muted">{cardPortfolioLabel}</p>
            <p className="text-4xl font-bold text-foreground" dir="ltr">
              ${portfolioValue.toLocaleString("en-US")}
            </p>
            <p className="text-xs text-success" dir="ltr">
              +0.00 (0%)
            </p>

            <div className="mt-5 rounded-2xl border border-border bg-surface/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">{cardTopLabel}</p>
                <span className="flex items-center gap-1 text-[10px] text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_theme(colors.success)]" aria-hidden="true" />
                  {liveLabel}
                </span>
              </div>
              {/* Real per-leader avg_daily_return_pct, so this moves with actual
                  platform performance day to day. Each bar links to that
                  leader's profile -- a real "interactive" mockup, not a static
                  picture. */}
              <div className="flex h-36 items-end justify-between gap-3" dir="ltr">
                {leaders.map((l) => (
                  <Link
                    key={l.id}
                    href={`/trader/${l.id}`}
                    className="group/bar relative flex flex-1 flex-col items-center gap-2 outline-none"
                  >
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md bg-background px-2 py-1 text-[10px] font-medium text-foreground opacity-0 shadow-lg shadow-black/30 ring-1 ring-border transition duration-150 group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100"
                    >
                      {l.name}
                    </span>
                    <span className="text-[11px] font-semibold text-success transition group-hover/bar:text-success">
                      {l.returnPct.toFixed(1)}%
                    </span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-success/60 to-success transition-[height,filter] duration-300 group-hover/bar:brightness-110 group-hover/bar:shadow-[0_0_10px_theme(colors.success/60%)]"
                      style={{ height: `${Math.max(12, (l.returnPct / maxReturn) * 88)}px` }}
                    />
                    <TraderAvatar
                      providerId={l.id}
                      name={l.name}
                      avatarUrl={l.avatarUrl}
                      ratingScore={l.ratingScore}
                      size={32}
                      showLevel={false}
                      className="transition group-hover/bar:scale-110 group-hover/bar:ring-2 group-hover/bar:ring-success"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
