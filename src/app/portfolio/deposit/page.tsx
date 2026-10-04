import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SimpleDepositForm } from "@/components/SimpleDepositForm";
import { DepositPanel } from "@/components/wallet/DepositPanel";
import { PendingDepositsRefresher, WalletStatusBadge } from "@/components/wallet/WalletStatus";
import { WalletPageShell, WalletNotice } from "@/components/wallet/WalletPageShell";
import { depositOptionsFor } from "@/lib/crypto/deposits";
import { explorerTxUrl, isNetworkId, shortAddress, displayTxHash } from "@/lib/crypto/networks";
import { getMoney } from "@/lib/money-server";
import { formatDateTime } from "@/lib/locale-format";
import { getUserTimeZone } from "@/lib/timezone";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("portfolioDepositTitle"), description: t("portfolioDepositDesc") };
}

export default async function DepositPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const t = await getTranslations("Portfolio");
  const tw = await getTranslations("Wallet");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fportfolio%2Fdeposit");

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();

  if (profile?.account_type !== "real") {
    return (
      <WalletPageShell title={t("depositTitle")} narrow>
        {error && <WalletNotice tone="danger">{error}</WalletNotice>}
        <p className="text-sm text-muted">{t("demoDepositNote")}</p>
        {/* Demo funds need no network/address and are credited instantly. */}
        <SimpleDepositForm />
      </WalletPageShell>
    );
  }

  const [networks, { data: recent }] = await Promise.all([
    depositOptionsFor(user.id),
    supabase
      .from("crypto_deposits")
      .select("id, network, tx_hash, amount, confirmations, required_confirmations, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (networks.length === 0) {
    return (
      <WalletPageShell title={t("depositTitle")}>
        <WalletNotice tone="warning" title={tw("depositUnavailableTitle")}>
          {tw("depositUnavailableBody")}
        </WalletNotice>
      </WalletPageShell>
    );
  }

  const money = await getMoney();
  const locale = (await getLocale()) as Locale;
  const timeZone = await getUserTimeZone();
  const rows = recent ?? [];

  return (
    <WalletPageShell title={t("depositTitle")}>
      {error && <WalletNotice tone="danger">{error}</WalletNotice>}
      <DepositPanel networks={networks} />

      {rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{tw("recentDeposits")}</h2>
            <Link href="/portfolio/history" className="text-xs text-accent hover:underline">
              {tw("viewAllHistory")}
            </Link>
          </div>
          <PendingDepositsRefresher active={rows.some((r) => r.status === "pending")} />
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {r.amount != null ? money(Number(r.amount)) : "—"} <span className="text-xs text-muted">· {r.network}</span>
                  </span>
                  {isNetworkId(r.network) && (
                    <a
                      href={explorerTxUrl(r.network, r.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="truncate font-mono text-[11px] text-muted hover:text-accent"
                    >
                      {shortAddress(displayTxHash(r.network, r.tx_hash), 10, 6)}
                    </a>
                  )}
                  <span className="text-[11px] text-muted">{formatDateTime(r.created_at, locale, { dateStyle: "medium", timeStyle: "short", timeZone })}</span>
                </div>
                <WalletStatusBadge status={r.status} confirmations={r.confirmations} required={r.required_confirmations} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </WalletPageShell>
  );
}
