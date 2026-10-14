import Link from "next/link";
import { getMoney } from "@/lib/money-server";
import { EmptyState } from "@/components/ui/EmptyState";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";
import { AppNav } from "@/components/AppNav";
import { ActiveCopyControlPanel } from "@/components/ActiveCopyControlPanel";
import { LinkTabs } from "@/components/LinkTabs";
import { ProfitShareLedger } from "@/components/ProfitShareLedger";
import { RiskFooter } from "@/components/RiskFooter";
import { TraderAvatar } from "@/components/TraderAvatar";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("copiesTitle"), description: t("copiesDesc") };
}

const TABS = ["active", "ended", "profit-share"] as const;
type Tab = (typeof TABS)[number];

export default async function CopiesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; tab?: string }>;
}) {
  const { error, saved, tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "active";
  const tr = await getTranslations("CopyRisk");
  const t = await getTranslations("Copies");
  const money = await getMoney();
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(tab === "active" ? "/copies" : `/copies?tab=${tab}`)}`);

  const [{ data: profile }, { data: allSubs }, { data: closed }] = await Promise.all([
    supabase.from("profiles").select("account_type").eq("id", user.id).single(),
    supabase
      .from("subscriptions")
      .select("id, provider_id, allocated_amount, max_drawdown_pct, tp_pct, sl_pct, trailing_pct, is_active")
      .eq("follower_id", user.id),
    supabase.from("simulated_positions").select("subscription_id, pnl, closed_at").eq("follower_id", user.id).eq("status", "closed"),
  ]);

  const pnlBySub = new Map<string, number>();
  const lastClosedBySub = new Map<string, string>();
  for (const p of closed ?? []) {
    pnlBySub.set(p.subscription_id, (pnlBySub.get(p.subscription_id) ?? 0) + (p.pnl ?? 0));
    if (p.closed_at && (lastClosedBySub.get(p.subscription_id) ?? "") < p.closed_at) lastClosedBySub.set(p.subscription_id, p.closed_at);
  }

  const subs = (allSubs ?? []).filter((s) => s.is_active);
  const endedSubs = (allSubs ?? []).filter((s) => !s.is_active);

  const ids = Array.from(new Set((allSubs ?? []).map((s) => s.provider_id)));
  const { data: cards } = ids.length
    ? await supabase.from("provider_cards").select("provider_id, display_name, avatar_url, rating_score").in("provider_id", ids)
    : { data: [] as { provider_id: string; display_name: string; avatar_url: string | null; rating_score: number | null }[] };
  const cardById = new Map((cards ?? []).map((c) => [c.provider_id, c]));

  const copies = subs.flatMap((s) => {
    const c = cardById.get(s.provider_id);
    if (!c) return [];
    return [
      {
        subscriptionId: s.id,
        providerId: s.provider_id,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        ratingScore: c.rating_score,
        allocatedAmount: Number(s.allocated_amount),
        maxDrawdownPct: Number(s.max_drawdown_pct),
        cumulativePnl: pnlBySub.get(s.id) ?? 0,
        takeProfitPct: s.tp_pct == null ? null : Number(s.tp_pct),
        stopLossPct: s.sl_pct == null ? null : Number(s.sl_pct),
        trailingPct: s.trailing_pct == null ? null : Number(s.trailing_pct),
      },
    ];
  });
  const totalAllocated = copies.reduce((sum, c) => sum + c.allocatedAmount, 0);
  const totalPnl = copies.reduce((sum, c) => sum + c.cumulativePnl, 0);

  const ended = endedSubs
    .flatMap((s) => {
      const c = cardById.get(s.provider_id);
      if (!c) return [];
      return [
        {
          id: s.id,
          providerId: s.provider_id,
          name: c.display_name,
          avatarUrl: c.avatar_url,
          rating: c.rating_score,
          allocated: Number(s.allocated_amount),
          pnl: pnlBySub.get(s.id) ?? 0,
          lastClosed: lastClosedBySub.get(s.id) ?? null,
        },
      ];
    })
    .sort((a, b) => (b.lastClosed ?? "").localeCompare(a.lastClosed ?? ""));

  const href = (key: Tab) => (key === "active" ? "/copies" : `/copies?tab=${key}`);

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>
        <LinkTabs
          active={tab}
          items={[
            { key: "active", href: href("active"), label: `${t("tabActive")}${copies.length ? ` (${copies.length})` : ""}` },
            { key: "ended", href: href("ended"), label: t("tabEnded") },
            { key: "profit-share", href: href("profit-share"), label: t("tabProfitShare") },
          ]}
        />
        {saved && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{tr("saved")}</p>}
        {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {tab === "active" &&
          (copies.length === 0 ? (
            <EmptyState message={t("empty")} actionHref="/discover" actionLabel={t("discover")} />
          ) : (
            <>
              <section className="grid grid-cols-3 rounded-2xl border border-border bg-surface text-center">
                <div className="p-4">
                  <p className="text-lg font-semibold tabular-nums">{copies.length}</p>
                  <p className="text-xs text-muted">{t("activeCopies")}</p>
                </div>
                <div className="border-s border-border p-4">
                  <p className="text-lg font-semibold tabular-nums" dir="ltr">
                    {money(totalAllocated)}
                  </p>
                  <p className="text-xs text-muted">{t("totalAllocated")}</p>
                </div>
                <div className="border-s border-border p-4">
                  <p className={`text-lg font-semibold tabular-nums ${totalPnl >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                    {money(totalPnl, { signed: true })}
                  </p>
                  <p className="text-xs text-muted">{t("realizedPnl")}</p>
                </div>
              </section>
              <div className="grid items-start gap-3 lg:grid-cols-2">
                {copies.map((c) => (
                  <ActiveCopyControlPanel key={c.subscriptionId} provider={c} returnTo="/copies" editable />
                ))}
              </div>
            </>
          ))}

        {tab === "ended" &&
          (ended.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">{t("endedEmpty")}</p>
          ) : (
            <div className="grid gap-2 lg:grid-cols-2">
              {ended.map((c) => (
                <Link
                  key={c.id}
                  href={`/trader/${c.providerId}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-accent/40"
                >
                  <TraderAvatar providerId={c.providerId} name={c.name} avatarUrl={c.avatarUrl} ratingScore={c.rating} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block text-xs text-muted">
                      {c.lastClosed ? t("endedLastTrade", { date: formatDate(c.lastClosed, locale) }) : t("endedNoTrades")}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span dir="ltr" className={`block text-sm font-semibold tabular-nums ${c.pnl >= 0 ? "text-success" : "text-danger"}`}>
                      {money(c.pnl, { signed: true })}
                    </span>
                    <span dir="ltr" className="block text-xs text-muted">
                      {money(c.allocated)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ))}

        {tab === "profit-share" && <ProfitShareLedger userId={user.id} />}

        <RiskFooter demo={profile?.account_type !== "real"} />
      </main>
    </>
  );
}
