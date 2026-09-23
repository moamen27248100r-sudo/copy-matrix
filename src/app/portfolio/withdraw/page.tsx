import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { WithdrawFlow } from "@/components/WithdrawFlow";

async function PageShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Portfolio");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <Link href="/portfolio" aria-label={t("close")} className="text-muted transition hover:text-foreground">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">{t("withdrawTitle")}</h1>

      {children}
    </main>
  );
}

export default async function WithdrawPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("Portfolio");
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ count: openPositionsCount }, { data: activeSub }, { data: profile }] = await Promise.all([
    supabase
      .from("simulated_positions")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .eq("status", "open"),
    supabase
      .from("subscriptions")
      .select("allocated_amount, copy_started_at")
      .eq("follower_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("profiles").select("balance, account_type").eq("id", user.id).single(),
  ]);

  // Same rule as requestWithdrawal's pre-check and the stop_copy/
  // apply_wallet_request DB functions (0096_fix_grace_period_direction.sql):
  // the leader is treated as having opened a trade once 10 minutes have
  // passed since the copy started, locking withdrawal from then on.
  const leaderHasTraded =
    !!activeSub?.copy_started_at && Date.now() - new Date(activeSub.copy_started_at).getTime() >= 10 * 60 * 1000;
  const blocked = (openPositionsCount ?? 0) > 0 || leaderHasTraded;

  if (blocked) {
    return (
      <PageShell>
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {t("withdrawBlockedError")}
        </p>
      </PageShell>
    );
  }

  const reserved = Number(activeSub?.allocated_amount ?? 0);
  const available = Math.max(0, Number(profile?.balance ?? 0) - reserved);
  const accountType: "real" | "demo" = profile?.account_type === "real" ? "real" : "demo";

  return (
    <PageShell>
      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <WithdrawFlow accountType={accountType} maxAvailable={available} />
    </PageShell>
  );
}
