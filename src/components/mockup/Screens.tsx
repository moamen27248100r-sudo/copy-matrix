import { Bell, Menu, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getMoney } from "@/lib/money-server";
import { BottomNav } from "@/components/BottomNav";
import { SidebarNav } from "@/components/SidebarNav";
import { WalletCard } from "@/components/WalletCard";
import { LeaderCard } from "@/components/LeaderCard";
import { Logo } from "@/components/Logo";
import { TraderAvatar } from "@/components/TraderAvatar";
import { TraderEquityChart } from "@/components/TraderEquityChart";
import { CopySummaryList } from "@/components/CopySummaryList";
import { RecentActivityTimeline } from "@/components/RecentActivityTimeline";
import { OnboardingStepsCard } from "@/components/OnboardingStepsCard";
import { MarketPulseGrid } from "@/components/TopMovers";
import { WatchlistGrid } from "@/components/HomeWatchlist";
import { LinkTabs } from "@/components/LinkTabs";
import { CopyFormPreview } from "@/components/mockup/CopyFormPreview";
import { MarketRowsPreview } from "@/components/mockup/MarketRowsPreview";
import {
  MOCK_COPIES,
  MOCK_LEADERS,
  MOCK_MARKET_ROWS,
  MOCK_PROFILE,
  MOCK_PULSE,
  MOCK_WATCHLIST,
  WALLET,
  mockActivity,
  profileDaily,
  walletTrades,
} from "@/data/mockup-fixtures";

// The screens of the home-page mock-up. Every one is assembled from the platform's own components
// (the wallet card, the leader card, the equity chart, the copy form, the market rows, the sidebar,
// the bottom bar ...) fed with the fixed display data of src/data/mockup-fixtures.ts -- never with a
// real customer's or leader's data. They are drawn on fixed canvases (phone 390 x 844, laptop
// 1280 x 800) by <ScaledCanvas> and are not interactive.

export const PHONE = { width: 390, height: 844 } as const;
export const LAPTOP = { width: 1280, height: 800 } as const;

function StatusBar() {
  return (
    <div dir="ltr" className="flex h-11 shrink-0 items-end justify-between px-7 pb-1 text-[15px] font-semibold text-white" aria-hidden="true">
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 18 12" className="h-3 w-[18px]" fill="currentColor">
          <rect x="0" y="7" width="3" height="5" rx="0.6" />
          <rect x="5" y="4" width="3" height="8" rx="0.6" />
          <rect x="10" y="1" width="3" height="11" rx="0.6" />
          <rect x="15" y="0" width="3" height="12" rx="0.6" opacity="0.35" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-3 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 5a10 10 0 0 1 14 0M3.5 7.5a6 6 0 0 1 9 0M6 10a2.3 2.3 0 0 1 4 0" />
        </svg>
        <span className="relative block h-3 w-[26px] rounded-[4px] border border-white/60 p-[1.5px]">
          <span className="block h-full w-[78%] rounded-[2px] bg-white" />
        </span>
      </span>
    </div>
  );
}

function AppHeader() {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-1 border-b border-border bg-[#0b1726] px-3">
      <span className="flex h-9 w-9 items-center justify-center rounded border border-border">
        <Menu className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="flex justify-center">
        <Logo iconClassName="h-4 w-4" textClassName="text-base" />
      </span>
      <span className="relative flex h-9 w-9 items-center justify-center rounded border border-border">
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
    </div>
  );
}

function PhoneShell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="relative flex h-[844px] w-[390px] flex-col overflow-hidden bg-background text-foreground" style={{ width: PHONE.width, height: PHONE.height }}>
      <StatusBar />
      <AppHeader />
      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-24 pt-4">{children}</div>
      <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-6">
        <BottomNav embedded activeHref={active} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- phone: wallet
export async function WalletScreen() {
  const t = await getTranslations("Portfolio");
  const trades = walletTrades();
  const unrealized = WALLET.unrealized;
  return (
    <PhoneShell active="/portfolio">
      <div className="flex flex-col gap-4">
        <h1 className="text-page-title">{t("title")}</h1>
        <WalletCard
          isDemo={false}
          depositsOn
          totalValue={WALLET.balance + unrealized}
          cash={WALLET.balance - WALLET.invested}
          invested={WALLET.invested}
          unrealized={unrealized}
          series={trades}
          netInvested={WALLET.netInvested}
          benchmarks={null}
        />
      </div>
    </PhoneShell>
  );
}

// ---------------------------------------------------------------- phone: discover
export async function DiscoverScreen() {
  const t = await getTranslations("Discover");
  return (
    <PhoneShell active="/discover">
      <div className="flex flex-col gap-3">
        <h1 className="text-page-title">{t("title")}</h1>
        <LinkTabs
          active="traders"
          items={[
            { key: "traders", href: "/discover", label: t("tabTraders") },
            { key: "markets", href: "/discover?tab=markets", label: t("tabMarkets") },
          ]}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <div className="w-full rounded-full border border-white/[0.08] bg-surface/80 py-2 ps-9 pe-3 text-base text-muted">{t("searchPlaceholder")}</div>
        </div>
        <div className="flex flex-col gap-3">
          {MOCK_LEADERS.slice(0, 2).map((l) => (
            <LeaderCard key={l.provider_id} provider={l} copyHref="/signup" sparkline={l.spark} maxDrawdownPct={l.mdd_30d} />
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}

// ---------------------------------------------------------------- phone: a trader's profile
export async function ProfileScreen({ dim = false }: { dim?: boolean }) {
  const t = await getTranslations("TraderProfile");
  const tc = await getTranslations("CopyDialog");
  const money = await getMoney();
  const p = MOCK_PROFILE;
  const tile = (value: React.ReactNode, label: string, cls = "") => (
    <div>
      <p className={`font-semibold ${cls}`} dir="ltr">
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
  return (
    <PhoneShell active="/discover">
      <div className={`flex flex-col gap-4 ${dim ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-4">
          <TraderAvatar providerId={p.leader.provider_id} name={p.leader.display_name} avatarUrl={p.leader.avatar_url} ratingScore={p.leader.rating_score} size={64} />
          <div className="min-w-0">
            <h1 className="max-w-full break-words text-xl font-semibold">{p.leader.display_name}</h1>
            <p className="mt-1 text-xs text-muted">
              {t("minCopyBadgeLabel")} <span dir="ltr">{money(p.minCopy)}</span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-slate-700/70 pt-4 text-center text-sm">
          {tile(p.copiers, t("statCopiers"))}
          {tile(`+${p.roiAll}%`, t("statTotalReturn"), "text-success")}
          {tile(`${Math.round(p.winRate)}%`, t("statOverallWinRate"))}
          {tile(`${p.maxDrawdown}%`, t("statMaxDrawdown"), "text-danger")}
          {tile(`${p.profitShare}%`, t("statProfitShare"))}
          {tile(t("hoursShort", { hours: p.avgHoldHours }), t("statAvgDuration"))}
        </div>
        <TraderEquityChart daily={profileDaily()} />
      </div>
      {!dim && (
        <div className="absolute inset-x-0 bottom-[88px] z-10 border-t border-border bg-background px-4 py-3 shadow-[0_-6px_16px_rgba(0,0,0,0.35)]">
          <div className="w-full rounded-lg bg-accent px-6 py-3 text-center text-base font-bold text-accent-foreground">{tc("open")}</div>
        </div>
      )}
    </PhoneShell>
  );
}

// ---------------------------------------------------------------- phone: the copy window
export async function CopyScreen() {
  return (
    <div className="relative h-[844px] w-[390px]" style={{ width: PHONE.width, height: PHONE.height }}>
      <ProfileScreen dim />
      <div className="absolute inset-0 z-20 flex items-end bg-black/60">
        <div className="max-h-[78%] w-full overflow-hidden rounded-t-3xl border border-white/[0.08] bg-[#0B132B] shadow-2xl">
          <CopyFormPreview
            providerId={MOCK_LEADERS[0].provider_id}
            providerName={MOCK_LEADERS[0].display_name}
            minAmount={MOCK_PROFILE.minCopy}
            defaultAmount={500}
            profitSharePct={MOCK_PROFILE.profitShare}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- phone: markets
export async function MarketsScreen() {
  const t = await getTranslations("Discover");
  return (
    <PhoneShell active="/discover">
      <div className="flex flex-col gap-3">
        <h1 className="text-page-title">{t("title")}</h1>
        <LinkTabs
          active="markets"
          items={[
            { key: "traders", href: "/discover", label: t("tabTraders") },
            { key: "markets", href: "/discover?tab=markets", label: t("tabMarkets") },
          ]}
        />
        <MarketRowsPreview rows={MOCK_MARKET_ROWS} />
      </div>
    </PhoneShell>
  );
}

// ---------------------------------------------------------------- laptop: the home dashboard
export async function DashboardScreen() {
  const t = await getTranslations("Dashboard");
  const tn = await getTranslations("Nav");
  const money = await getMoney();
  const value = WALLET.balance + WALLET.unrealized;
  return (
    <div className="flex bg-background text-foreground" style={{ width: LAPTOP.width, height: LAPTOP.height }}>
      <div className="h-full shrink-0">
        <SidebarNav isAdmin={false} accountNumber={48271905} displayName="Alex Morgan" email="alex.morgan@example.com" kycStatus="approved" accountType="demo" embedded activePath="/dashboard" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-end border-b border-border bg-[#0b1726] px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-border">
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-6">
          <h1 className="sr-only">{tn("navHome")}</h1>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted">
              {t("portfolioValue")}
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">{t("accountDemo")}</span>
            </span>
            <span dir="ltr" className="text-lg font-bold tabular-nums">
              {money(value)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-5">
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">{t("traderYouCopy")}</h2>
                <CopySummaryList items={MOCK_COPIES} />
              </section>
              <RecentActivityTimeline events={mockActivity()} />
            </div>
            <div className="flex flex-col gap-5">
              <OnboardingStepsCard profileComplete kycDone firstCopyDone={false} notificationsReady={false} />
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">{t("marketPulseTitle")}</h2>
                <MarketPulseGrid items={MOCK_PULSE} />
              </section>
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">{t("watchlistTitle")}</h2>
                <WatchlistGrid items={MOCK_WATCHLIST.slice(0, 4)} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
