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

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("portfolioWithdrawTitle"), description: t("portfolioWithdrawDesc") };
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

  if (!user) redirect("/login?next=%2Fportfolio%2Fwithdraw");

  const [{ count: openPositionsCount }, { data: activeSubs }, { data: profile }, { data: kyc }] = await Promise.all([
    supabase
      .from("simulated_positions")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .eq("status", "open"),
    supabase.from("subscriptions").select("allocated_amount").eq("follower_id", user.id).eq("is_active", true),
    supabase.from("profiles").select("balance, account_type").eq("id", user.id).single(),
    supabase.from("kyc_submissions").select("status").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const isDemoAccount = profile?.account_type !== "real";

  // Real withdrawals need approved identity verification (wallet_requests trigger, 0232).
  if (!isDemoAccount && kyc?.status !== "approved") {
    return (
      <PageShell>
        <p className="rounded border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{t("kycRequiredNotice")}</p>
        <Link
          href="/kyc"
          className="rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
        >
          {t("kycRequiredCta")}
        </Link>
      </PageShell>
    );
  }

  // No withdrawal while a copied trade is open, on either account type; it unlocks by itself
  // once every trade is closed.
  if ((openPositionsCount ?? 0) > 0) {
    return (
      <PageShell>
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {t("withdrawBlockedError")}
        </p>
      </PageShell>
    );
  }

  const reserved = (activeSubs ?? []).reduce((sum, sub) => sum + Number(sub.allocated_amount ?? 0), 0);
  const available = Math.max(0, Number(profile?.balance ?? 0) - reserved);
  const accountType: "real" | "demo" = profile?.account_type === "real" ? "real" : "demo";

  return (
    <PageShell>
      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}
      <p className="text-sm text-muted">{accountType === "demo" ? t("demoWithdrawNote") : t("reviewProcessingNote")}</p>
      <WithdrawFlow accountType={accountType} maxAvailable={available} />
    </PageShell>
  );
}
