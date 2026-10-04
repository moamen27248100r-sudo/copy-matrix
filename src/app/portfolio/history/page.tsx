import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { WalletNotice, WalletPageShell } from "@/components/wallet/WalletPageShell";
import { PendingDepositsRefresher, WalletStatusBadge } from "@/components/wallet/WalletStatus";
import { ConfirmButton } from "@/components/ConfirmButton";
import { cancelCryptoWithdrawal } from "@/app/portfolio/actions";
import { displayTxHash, explorerAddressUrl, explorerTxUrl, isNetworkId, shortAddress, type NetworkId } from "@/lib/crypto/networks";
import { getMoney } from "@/lib/money-server";
import { formatDateTime } from "@/lib/locale-format";
import { getUserTimeZone } from "@/lib/timezone";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const t = await getTranslations("Wallet");
  return { title: t("historyTitle") };
}

function TxLink({ network, hash }: { network: string; hash: string | null }) {
  if (!hash || !isNetworkId(network)) return <span className="text-muted">—</span>;
  return (
    <a href={explorerTxUrl(network, hash)} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-mono text-xs text-accent hover:underline">
      {shortAddress(displayTxHash(network, hash), 8, 6)}
    </a>
  );
}

function AddressLink({ network, address }: { network: string; address: string }) {
  if (!isNetworkId(network)) return <span dir="ltr">{shortAddress(address)}</span>;
  return (
    <a href={explorerAddressUrl(network as NetworkId, address)} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-mono text-xs text-muted hover:text-accent">
      {shortAddress(address)}
    </a>
  );
}

export default async function WalletHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; requested?: string; cancelled?: string; error?: string }>;
}) {
  const { tab, requested, cancelled, error } = await searchParams;
  const showWithdrawals = tab === "withdrawals";
  const t = await getTranslations("Portfolio");
  const tw = await getTranslations("Wallet");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fportfolio%2Fhistory");

  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
  if (profile?.account_type !== "real") {
    return (
      <WalletPageShell title={tw("historyTitle")} wide>
        <WalletNotice tone="info">{tw("historyRealOnly")}</WalletNotice>
      </WalletPageShell>
    );
  }

  const money = await getMoney();
  const locale = (await getLocale()) as Locale;
  const timeZone = await getUserTimeZone();
  const date = (iso: string) => formatDateTime(iso, locale, { dateStyle: "medium", timeStyle: "short", timeZone });

  const [{ data: deposits }, { data: withdrawals }] = await Promise.all([
    showWithdrawals
      ? Promise.resolve({ data: null })
      : supabase
          .from("crypto_deposits")
          .select("id, network, tx_hash, deposit_address, amount, confirmations, required_confirmations, status, failure_reason, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
    showWithdrawals
      ? supabase
          .from("crypto_withdrawals")
          .select("id, network, address, amount, fee, net_amount, status, tx_hash, reject_reason, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: null }),
  ]);

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${active ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`;
  const th = "px-3 py-2 text-start font-medium whitespace-nowrap";
  const td = "px-3 py-2.5 whitespace-nowrap align-top";

  return (
    <WalletPageShell title={tw("historyTitle")} wide>
      {requested && <WalletNotice tone="success">{tw("withdrawRequested")}</WalletNotice>}
      {cancelled && <WalletNotice tone="success">{tw("withdrawCancelled")}</WalletNotice>}
      {error && <WalletNotice tone="danger">{error}</WalletNotice>}

      <div className="flex items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1" aria-label={tw("historyTitle")}>
          <Link href="/portfolio/history" className={tabClass(!showWithdrawals)} aria-current={!showWithdrawals ? "page" : undefined}>
            {tw("tabDeposits")}
          </Link>
          <Link href="/portfolio/history?tab=withdrawals" className={tabClass(showWithdrawals)} aria-current={showWithdrawals ? "page" : undefined}>
            {tw("tabWithdrawals")}
          </Link>
        </nav>
        <Link href={showWithdrawals ? "/portfolio/withdraw" : "/portfolio/deposit"} className="text-sm font-medium text-accent hover:underline">
          {showWithdrawals ? tw("newWithdrawal") : tw("newDeposit")}
        </Link>
      </div>

      {!showWithdrawals &&
        ((deposits ?? []).length === 0 ? (
          <p className="text-sm text-muted">{tw("noDeposits")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <PendingDepositsRefresher active={(deposits ?? []).some((d) => d.status === "pending")} />
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-white/[0.03] text-xs text-muted">
                <tr>
                  <th className={th}>{t("date")}</th>
                  <th className={th}>{tw("colNetwork")}</th>
                  <th className={th}>{t("amount")}</th>
                  <th className={th}>{t("status")}</th>
                  <th className={th}>{tw("colTxid")}</th>
                  <th className={th}>{tw("colAddress")}</th>
                </tr>
              </thead>
              <tbody>
                {(deposits ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-white/5">
                    <td className={`${td} text-xs text-muted`}>{date(d.created_at)}</td>
                    <td className={td}>{d.network}</td>
                    <td className={td}>{d.amount != null ? money(Number(d.amount)) : "—"}</td>
                    <td className={td}>
                      <div className="flex flex-col items-start gap-1">
                        <WalletStatusBadge status={d.status} confirmations={d.confirmations} required={d.required_confirmations} />
                        {d.failure_reason && <span className="max-w-[220px] whitespace-normal text-[11px] text-muted">{tw(`reason_${d.failure_reason}`)}</span>}
                      </div>
                    </td>
                    <td className={td}>
                      <TxLink network={d.network} hash={d.tx_hash} />
                    </td>
                    <td className={td}>
                      <AddressLink network={d.network} address={d.deposit_address} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {showWithdrawals &&
        ((withdrawals ?? []).length === 0 ? (
          <p className="text-sm text-muted">{tw("noWithdrawals")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-white/[0.03] text-xs text-muted">
                <tr>
                  <th className={th}>{t("date")}</th>
                  <th className={th}>{tw("colNetwork")}</th>
                  <th className={th}>{t("amount")}</th>
                  <th className={th}>{tw("colFee")}</th>
                  <th className={th}>{tw("receiveLabel")}</th>
                  <th className={th}>{t("status")}</th>
                  <th className={th}>{tw("colTxid")}</th>
                  <th className={th}>{tw("colAddress")}</th>
                </tr>
              </thead>
              <tbody>
                {(withdrawals ?? []).map((w) => (
                  <tr key={w.id} className="border-t border-white/5">
                    <td className={`${td} text-xs text-muted`}>{date(w.created_at)}</td>
                    <td className={td}>{w.network}</td>
                    <td className={td}>{money(Number(w.amount))}</td>
                    <td className={td}>{money(Number(w.fee))}</td>
                    <td className={td}>{money(Number(w.net_amount))}</td>
                    <td className={td}>
                      <div className="flex flex-col items-start gap-1">
                        <WalletStatusBadge status={w.status} />
                        {(w.status === "rejected" || w.status === "cancelled") && (
                          <span className="text-[11px] text-muted">{tw("refundedNote")}</span>
                        )}
                        {w.status === "rejected" && w.reject_reason && (
                          <span className="max-w-[220px] whitespace-normal text-[11px] text-muted">{w.reject_reason}</span>
                        )}
                        {w.status === "processing" && (
                          <form action={cancelCryptoWithdrawal}>
                            <input type="hidden" name="id" value={w.id} />
                            <ConfirmButton confirmText={tw("cancelConfirm")} className="text-xs font-medium text-danger hover:underline">
                              {tw("cancelWithdraw")}
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      <TxLink network={w.network} hash={w.tx_hash} />
                    </td>
                    <td className={td}>
                      <AddressLink network={w.network} address={w.address} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </WalletPageShell>
  );
}
