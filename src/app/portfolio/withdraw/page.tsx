import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { WithdrawFlow } from "@/components/WithdrawFlow";
import { WithdrawForm, type WithdrawNetworkOption } from "@/components/wallet/WithdrawForm";
import { WalletNotice, WalletPageShell } from "@/components/wallet/WalletPageShell";
import { WalletStatusBadge } from "@/components/wallet/WalletStatus";
import { ConfirmButton } from "@/components/ConfirmButton";
import { cancelCryptoWithdrawal } from "@/app/portfolio/actions";
import { hasVerifiedTotp } from "@/lib/mfa";
import { isNetworkId, shortAddress } from "@/lib/crypto/networks";
import { getMoney } from "@/lib/money-server";
import { formatDateTime } from "@/lib/locale-format";
import { getUserTimeZone } from "@/lib/timezone";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("portfolioWithdrawTitle"), description: t("portfolioWithdrawDesc") };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Request time, read once per render: the rolling 24-hour window for limits and the security lock.
function requestClock() {
  const now = Date.now();
  return { now, since: new Date(now - DAY_MS).toISOString() };
}

export default async function WithdrawPage({ searchParams }: { searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const t = await getTranslations("Portfolio");
  const tw = await getTranslations("Wallet");
  const { error, cancelled } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fportfolio%2Fwithdraw");

  const { now, since } = requestClock();
  const [{ count: openPositionsCount }, { data: activeSubs }, { data: profile }, { data: kyc }, { data: networkRows }, { data: recent }, { data: security }] =
    await Promise.all([
      supabase.from("simulated_positions").select("id", { count: "exact", head: true }).eq("follower_id", user.id).eq("status", "open"),
      supabase.from("subscriptions").select("allocated_amount").eq("follower_id", user.id).eq("is_active", true),
      supabase.from("profiles").select("balance, account_type").eq("id", user.id).single(),
      supabase.from("kyc_submissions").select("status").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("crypto_networks").select("id, withdraw_fee, min_withdraw, daily_withdraw_limit, withdraw_enabled").order("sort_order"),
      supabase
        .from("crypto_withdrawals")
        .select("id, network, address, amount, net_amount, status, created_at")
        .eq("user_id", user.id)
        .or(`status.in.(processing,sending),created_at.gte.${since}`)
        .order("created_at", { ascending: false }),
      supabase.from("account_security_events").select("password_changed_at, mfa_changed_at").eq("user_id", user.id).maybeSingle(),
    ]);

  const reserved = (activeSubs ?? []).reduce((sum, sub) => sum + Number(sub.allocated_amount ?? 0), 0);
  const available = Math.max(0, Number(profile?.balance ?? 0) - reserved);

  // Demo account: instant, virtual, unchanged.
  if (profile?.account_type !== "real") {
    if ((openPositionsCount ?? 0) > 0) {
      return (
        <WalletPageShell title={t("withdrawTitle")} narrow>
          <WalletNotice tone="danger">{t("withdrawBlockedError")}</WalletNotice>
        </WalletPageShell>
      );
    }
    return (
      <WalletPageShell title={t("withdrawTitle")} narrow>
        {error && <WalletNotice tone="danger">{error}</WalletNotice>}
        <p className="text-sm text-muted">{t("demoWithdrawNote")}</p>
        <WithdrawFlow maxAvailable={available} />
      </WalletPageShell>
    );
  }

  const money = await getMoney();
  const locale = (await getLocale()) as Locale;
  const timeZone = await getUserTimeZone();
  const rows = recent ?? [];
  const inProgress = rows.filter((r) => r.status === "processing" || r.status === "sending");

  const inProgressList = inProgress.length > 0 && (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{tw("pendingWithdrawals")}</h2>
      <ul className="flex flex-col gap-2">
        {inProgress.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm">
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">
                {money(Number(r.amount))} <span className="text-xs text-muted">· {r.network}</span>
              </span>
              <span dir="ltr" className="truncate font-mono text-[11px] text-muted">
                {shortAddress(r.address, 8, 6)}
              </span>
              <span className="text-[11px] text-muted">{formatDateTime(r.created_at, locale, { dateStyle: "medium", timeStyle: "short", timeZone })}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <WalletStatusBadge status={r.status} />
              {r.status === "processing" && (
                <form action={cancelCryptoWithdrawal}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="returnTo" value="/portfolio/withdraw" />
                  <ConfirmButton confirmText={tw("cancelConfirm")} className="text-xs font-medium text-danger hover:underline">
                    {tw("cancelWithdraw")}
                  </ConfirmButton>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  const shell = (content: React.ReactNode) => (
    <WalletPageShell title={t("withdrawTitle")}>
      {error && <WalletNotice tone="danger">{error}</WalletNotice>}
      {cancelled && <WalletNotice tone="success">{tw("withdrawCancelled")}</WalletNotice>}
      {inProgressList}
      {content}
    </WalletPageShell>
  );

  // Real withdrawals need approved identity verification (CM024).
  if (kyc?.status !== "approved") {
    return shell(
      <WalletNotice tone="warning" action={{ href: "/kyc", label: t("kycRequiredCta") }}>
        {t("kycRequiredNotice")}
      </WalletNotice>,
    );
  }

  // No withdrawal while a copied trade is open; it unlocks by itself once every trade is closed.
  if ((openPositionsCount ?? 0) > 0) {
    return shell(<WalletNotice tone="danger">{t("withdrawBlockedError")}</WalletNotice>);
  }

  const networks: WithdrawNetworkOption[] = (networkRows ?? [])
    .filter((n) => n.withdraw_enabled && isNetworkId(n.id))
    .map((n) => ({
      id: n.id,
      fee: Number(n.withdraw_fee),
      minWithdraw: Number(n.min_withdraw),
      dailyLimit: Number(n.daily_withdraw_limit),
      dailyUsed: rows
        .filter((r) => r.network === n.id && r.status !== "rejected" && r.status !== "cancelled" && new Date(r.created_at).getTime() > now - DAY_MS)
        .reduce((sum, r) => sum + Number(r.amount), 0),
    }));

  if (networks.length === 0) {
    return shell(
      <WalletNotice tone="warning" title={tw("withdrawUnavailableTitle")}>
        {tw("withdrawUnavailableBody")}
      </WalletNotice>,
    );
  }

  if (!hasVerifiedTotp(user)) {
    return shell(
      <WalletNotice tone="warning" title={tw("mfaRequiredTitle")} action={{ href: "/account/security", label: tw("mfaRequiredCta") }}>
        {tw("mfaRequiredBody")}
      </WalletNotice>,
    );
  }

  const lastChange = [security?.password_changed_at, security?.mfa_changed_at]
    .filter((v): v is string => !!v)
    .map((v) => new Date(v).getTime())
    .sort((a, b) => b - a)[0];
  if (lastChange && lastChange + DAY_MS > now) {
    return shell(
      <WalletNotice tone="warning" title={tw("securityLockTitle")}>
        {tw("securityLockBody", {
          date: formatDateTime(new Date(lastChange + DAY_MS).toISOString(), locale, { dateStyle: "medium", timeStyle: "short", timeZone }),
        })}
      </WalletNotice>,
    );
  }

  return shell(<WithdrawForm networks={networks} available={available} />);
}
