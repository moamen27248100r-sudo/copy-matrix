import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId, currentTier } from "@/lib/lead-trader";
import { computeActiveTradingDays } from "@/lib/reliability";
import { removeFollower, createFollowerInvite, postAnnouncement } from "@/app/lead/followers/actions";

function maskId(email: string | null, id: string) {
  if (email) {
    const [local, domain] = email.split("@");
    if (!domain) return email;
    return local.length <= 2 ? `${local[0]}****@${domain}` : `${local[0]}****${local[local.length - 1]}@${domain}`;
  }
  return `${id.slice(0, 4)}****${id.slice(-4)}`;
}

export default async function LeadFollowersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("LeadTrader.followers");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: subs }, { data: allSignals }, { data: invites }, inviteCodeRes] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, follower_id, allocated_amount, is_active, copy_started_at, max_drawdown_pct")
      .eq("provider_id", providerId)
      .order("copy_started_at", { ascending: false }),
    supabase.from("signals").select("opened_at").eq("provider_id", providerId).eq("created_by_admin", false),
    supabase.from("follower_invites").select("id, code, invited_email, used_by, used_at, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }),
    supabase.rpc("lead_trader_get_or_create_invite_code"),
  ]);

  const subscriptions = subs ?? [];
  const subIds = subscriptions.map((s) => s.id);
  const followerIds = Array.from(new Set(subscriptions.map((s) => s.follower_id)));

  const [{ data: followerProfiles }, { data: positions }] = await Promise.all([
    followerIds.length ? supabase.from("profiles").select("id, email, balance").in("id", followerIds) : Promise.resolve({ data: [] as { id: string; email: string | null; balance: number }[] }),
    subIds.length
      ? supabase.from("simulated_positions").select("subscription_id, status, pnl").in("subscription_id", subIds)
      : Promise.resolve({ data: [] as { subscription_id: string; status: string; pnl: number | null }[] }),
  ]);

  const profileById = new Map((followerProfiles ?? []).map((p) => [p.id, p]));
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
  const { data: providerRow } = await supabase.from("providers").select("profit_share_pct").eq("id", providerId).single();
  const tier = currentTier({ activeDays, aum, followerProfit: realizedFollowerProfit, maxDrawdownPct: null });
  const sharePct = Number(providerRow?.profit_share_pct ?? 0);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteCode = inviteCodeRes.data as string | null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">{t("title")}</h1>
      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">{t("seats", { current: activeSubs.length, max: tier.maxFollowers })}</p>
        {inviteCode && (
          <div className="mt-2 flex flex-col gap-1">
            <p className="text-xs text-muted">{t("inviteLinkLabel")}</p>
            <code dir="ltr" className="break-all rounded-lg border border-border bg-background px-3 py-2 text-xs">
              {origin}/i/{inviteCode}
            </code>
          </div>
        )}
      </section>

      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted">{t("noFollowers")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 text-start font-normal">{t("follower")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("invested")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("balance")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("profit")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("shareFromThem")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("daysFollowing")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("status")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => {
                const profile = profileById.get(s.follower_id);
                const profit = pnlBySub.get(s.id) ?? 0;
                const share = Math.max(0, profit) * (sharePct / 100);
                const days = s.copy_started_at ? Math.max(0, Math.floor((Date.now() - new Date(s.copy_started_at).getTime()) / 86400000)) : 0;
                return (
                  <tr key={s.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2" dir="ltr">
                      {maskId(profile?.email ?? null, s.follower_id)}
                    </td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">
                      ${Number(s.allocated_amount).toLocaleString("en-US")}
                    </td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">
                      ${Number(profile?.balance ?? 0).toLocaleString("en-US")}
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${profit >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                      {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">
                      ${share.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{days}</td>
                    <td className="px-3 py-2">
                      <span className={s.is_active ? "text-success" : "text-muted"}>{s.is_active ? t("active") : t("stopped")}</span>
                    </td>
                    <td className="px-3 py-2">
                      {s.is_active && (
                        <form action={removeFollower} className="flex items-center gap-1.5">
                          <input type="hidden" name="subscriptionId" value={s.id} />
                          <input name="reason" type="text" placeholder={t("reasonPlaceholder")} className="w-28 rounded border border-border bg-background px-1.5 py-1 text-xs" />
                          <button
                            type="submit"
                            disabled={(openCountBySub.get(s.id) ?? 0) > 0}
                            className="rounded border border-border px-2 py-1 text-xs text-foreground hover:border-danger/50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                            title={(openCountBySub.get(s.id) ?? 0) > 0 ? t("removeHasOpenPositions") : undefined}
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

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-section-title">{t("invitesTitle")}</h2>
        <form action={createFollowerInvite} className="flex flex-wrap gap-2">
          <input name="email" type="email" placeholder={t("invitedEmailPlaceholder")} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
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

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-section-title">{t("announcementTitle")}</h2>
        <form action={postAnnouncement} className="flex flex-col gap-2">
          <textarea name="body" rows={2} maxLength={280} placeholder={t("announcementPlaceholder")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" className="self-start rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            {t("sendAnnouncement")}
          </button>
        </form>
      </section>
    </div>
  );
}
