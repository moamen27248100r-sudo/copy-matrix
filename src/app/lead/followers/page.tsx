import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId, currentTier } from "@/lib/lead-trader";
import { computeActiveTradingDays } from "@/lib/reliability";
import { removeFollower, createFollowerInvite } from "@/app/lead/followers/actions";
import { setWhitelistEnabled } from "@/app/lead/followers/toggle-whitelist";

const PAGE_SIZE = 20;

type CopierRow = { id: string; alias: string; allocated_amount: number; pnl: number; joined_at: string | null; is_active: boolean; open_positions: number };

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadFollowersTitle"), description: t("leadFollowersDesc") };
}

export default async function LeadFollowersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string; status?: string; page?: string }>;
}) {
  const { error, q, status, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const t = await getTranslations("LeadTrader.followers");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead%2Ffollowers");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: subs }, { data: allSignals }, { data: invites }, inviteCodeRes, { data: ltProfile }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, follower_id, allocated_amount, is_active, copy_started_at, max_drawdown_pct")
      .eq("provider_id", providerId)
      .order("copy_started_at", { ascending: false }),
    supabase.from("signals").select("opened_at").eq("provider_id", providerId).eq("created_by_admin", false),
    supabase.from("follower_invites").select("id, code, invited_email, used_by, used_at, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }),
    supabase.rpc("lead_trader_get_or_create_invite_code"),
    supabase.from("lead_trader_profiles").select("whitelist_enabled").eq("provider_id", providerId).maybeSingle(),
  ]);

  const subscriptions = subs ?? [];
  const subIds = subscriptions.map((s) => s.id);

  const [{ data: copiersData }, { data: positions }] = await Promise.all([
    supabase.rpc("lead_dashboard_copiers", { p_search: q ?? null, p_status: status ?? null, p_limit: PAGE_SIZE, p_offset: (pageNum - 1) * PAGE_SIZE }),
    subIds.length
      ? supabase.from("simulated_positions").select("subscription_id, status, pnl").in("subscription_id", subIds)
      : Promise.resolve({ data: [] as { subscription_id: string; status: string; pnl: number | null }[] }),
  ]);

  const copiers = (copiersData ?? { total: 0, rows: [] }) as { total: number; rows: CopierRow[] };
  const totalPages = Math.max(1, Math.ceil(copiers.total / PAGE_SIZE));
  const pageHref = (n: number) => `/lead/followers?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(n) })}`;
  const pnlBySub = new Map<string, number>();
  const openCountBySub = new Map<string, number>();
  for (const p of positions ?? []) {
    if (p.status === "closed") pnlBySub.set(p.subscription_id, (pnlBySub.get(p.subscription_id) ?? 0) + (p.pnl ?? 0));
    if (p.status === "open") openCountBySub.set(p.subscription_id, (openCountBySub.get(p.subscription_id) ?? 0) + 1);
  }

  const activeSubs = subscriptions.filter((s) => s.is_active);
  const aum = activeSubs.reduce((sum, s) => sum + Number(s.allocated_amount), 0);
  const realizedFollowerProfit = Array.from(pnlBySub.values()).reduce((a, b) => a + b, 0);
  const activeDays = computeActiveTradingDays((allSignals ?? []).map((s) => ({ opened_at: s.opened_at })));
  const tier = currentTier({ activeDays, aum, followerProfit: realizedFollowerProfit, maxDrawdownPct: null });

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteCode = inviteCodeRes.data as string | null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">{t("title")}</h1>
      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">{t("seats", { current: activeSubs.length, max: tier.maxFollowers })}</p>
        <form action={setWhitelistEnabled} className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <div>
            <p className="text-sm font-medium">{t("whitelistTitle")}</p>
            <p className="text-xs text-muted">{t("whitelistDesc")}</p>
          </div>
          <input type="hidden" name="enabled" value={ltProfile?.whitelist_enabled ? "false" : "true"} />
          <button
            type="submit"
            className={
              ltProfile?.whitelist_enabled
                ? "shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground"
                : "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted"
            }
          >
            {ltProfile?.whitelist_enabled ? t("whitelistOn") : t("whitelistOff")}
          </button>
        </form>
        {inviteCode && (
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-xs text-muted">{t("inviteLinkLabel")}</p>
            <code dir="ltr" className="break-all rounded-lg border border-border bg-background px-3 py-2 text-xs">
              {origin}/i/{inviteCode}
            </code>
          </div>
        )}
      </section>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder={t("searchPlaceholder")} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-base" />
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-border bg-background px-2 py-2 text-base">
          <option value="">{t("filterAll")}</option>
          <option value="active">{t("active")}</option>
          <option value="stopped">{t("stopped")}</option>
        </select>
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
          {t("apply")}
        </button>
      </form>

      {copiers.rows.length === 0 ? (
        <p className="text-sm text-muted">{q || status ? t("noMatches") : t("noFollowers")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 text-start font-normal">{t("follower")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("invested")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("profit")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("joined")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("status")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {copiers.rows.map((c) => {
                const profit = Number(c.pnl);
                return (
                  <tr key={c.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2" dir="ltr">
                      {c.alias}
                    </td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">
                      ${Number(c.allocated_amount).toLocaleString("en-US")}
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${profit >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                      {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted tabular-nums" dir="ltr">
                      {c.joined_at ? new Date(c.joined_at).toLocaleDateString("en-US") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={c.is_active ? "text-success" : "text-muted"}>{c.is_active ? t("active") : t("stopped")}</span>
                    </td>
                    <td className="px-3 py-2">
                      {c.is_active && (
                        <form action={removeFollower} className="flex items-center gap-1.5">
                          <input type="hidden" name="subscriptionId" value={c.id} />
                          <input name="reason" type="text" placeholder={t("reasonPlaceholder")} className="w-28 rounded border border-border bg-background px-1.5 py-1 text-base" />
                          <button
                            type="submit"
                            disabled={c.open_positions > 0}
                            className="rounded border border-border px-2 py-1 text-xs text-foreground hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                            title={c.open_positions > 0 ? t("removeHasOpenPositions") : undefined}
                          >
                            {t("remove")}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {pageNum > 1 ? (
            <Link href={pageHref(pageNum - 1)} className="text-accent hover:underline">
              {t("prev")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted tabular-nums">
            {pageNum} / {totalPages}
          </span>
          {pageNum < totalPages ? (
            <Link href={pageHref(pageNum + 1)} className="text-accent hover:underline">
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-section-title">{t("invitesTitle")}</h2>
        <p className="text-xs text-muted">{t("invitesStats", { used: (invites ?? []).filter((i) => i.used_by).length, total: (invites ?? []).length })}</p>
        <form action={createFollowerInvite} className="flex flex-wrap gap-2">
          <input name="email" type="email" placeholder={t("invitedEmailPlaceholder")} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-base" />
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            {t("createInvite")}
          </button>
        </form>
        {(invites ?? []).length > 0 && (
          <div className="flex flex-col gap-1.5">
            {invites!.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                <span dir="ltr">{i.invited_email ?? i.code}</span>
                <span className={i.used_by ? "text-success" : "text-muted"}>{i.used_by ? t("inviteUsed") : t("invitePending")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Link href="/lead/announcements" className="text-sm text-accent hover:underline">
        {t("announcementsLink")}
      </Link>
    </div>
  );
}
