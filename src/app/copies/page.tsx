import { getMoney } from "@/lib/money-server";
import { EmptyState } from "@/components/ui/EmptyState";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { ActiveCopyControlPanel } from "@/components/ActiveCopyControlPanel";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("copiesTitle"), description: t("copiesDesc") };
}

export default async function CopiesPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const tr = await getTranslations("CopyRisk");
  const t = await getTranslations("Copies");
  const money = await getMoney();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fcopies");

  const [{ data: subs }, { data: closed }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, provider_id, allocated_amount, max_drawdown_pct, tp_pct, sl_pct, trailing_pct")
      .eq("follower_id", user.id)
      .eq("is_active", true),
    supabase.from("simulated_positions").select("subscription_id, pnl").eq("follower_id", user.id).eq("status", "closed"),
  ]);

  const pnlBySub = new Map<string, number>();
  for (const p of closed ?? []) pnlBySub.set(p.subscription_id, (pnlBySub.get(p.subscription_id) ?? 0) + (p.pnl ?? 0));

  const ids = (subs ?? []).map((s) => s.provider_id);
  const { data: cards } = ids.length
    ? await supabase.from("provider_cards").select("provider_id, display_name, avatar_url, rating_score").in("provider_id", ids)
    : { data: [] as { provider_id: string; display_name: string; avatar_url: string | null; rating_score: number | null }[] };

  const copies = (subs ?? []).flatMap((s) => {
    const c = (cards ?? []).find((x) => x.provider_id === s.provider_id);
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

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>
        {saved && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{tr("saved")}</p>}
        {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {copies.length === 0 ? (
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
            <div className="flex flex-col gap-3">
              {copies.map((c) => (
                <ActiveCopyControlPanel key={c.subscriptionId} provider={c} returnTo="/copies" editable />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
