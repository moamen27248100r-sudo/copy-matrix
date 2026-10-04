"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { submitDepositTxid, type DepositFormState } from "@/app/portfolio/actions";
import { useMoney } from "@/lib/money-client";
import { CHAINS, estimatedMinutes, networkLabel, normalizeTxHash, type NetworkId } from "@/lib/crypto/networks";
import { SubmitButton } from "@/components/SubmitButton";
import { NetworkIcon } from "@/components/NetworkIcon";

export type DepositNetworkOption = { id: NetworkId; address: string; minDeposit: number; confirmations: number };

export function DepositPanel({ networks }: { networks: DepositNetworkOption[] }) {
  const t = useTranslations("Wallet");
  const money = useMoney();
  const [selectedId, setSelectedId] = useState<NetworkId>(networks[0].id);
  const selected = networks.find((n) => n.id === selectedId) ?? networks[0];
  const [qr, setQr] = useState<{ address: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [state, formAction] = useActionState<DepositFormState, FormData>(submitDepositTxid, {});

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(selected.address, { width: 240, margin: 1, color: { dark: "#0B132B", light: "#ffffff" } }).then((url) => {
      if (!cancelled) setQr({ address: selected.address, url });
    });
    return () => {
      cancelled = true;
    };
  }, [selected.address]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(selected.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable: the address stays selectable by hand
    }
  }

  const hashValid = normalizeTxHash(txHash) != null;
  const submitted = state.submitted;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">{t("coinLabel")}</p>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#26A17B] text-xs font-bold text-white" aria-hidden="true">
            ₮
          </span>
          <span className="text-sm font-semibold text-foreground">USDT</span>
          <span className="text-xs text-muted">Tether</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">{t("networkLabel")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("networkLabel")}>
          {networks.map((n) => (
            <button
              key={n.id}
              type="button"
              role="radio"
              aria-checked={n.id === selected.id}
              onClick={() => setSelectedId(n.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start transition ${
                n.id === selected.id ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.03] hover:border-accent/40"
              }`}
            >
              <NetworkIcon network={CHAINS[n.id].chainName} size={24} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{n.id}</span>
                <span className="text-[11px] text-muted">{CHAINS[n.id].chainName}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="rounded-xl bg-white p-2.5">
          {qr && qr.address === selected.address ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.url} alt={t("qrAlt", { network: networkLabel(selected.id) })} width={180} height={180} />
          ) : (
            <div className="h-[180px] w-[180px] animate-pulse rounded bg-slate-200" />
          )}
        </div>
        <div className="w-full">
          <p className="text-xs text-muted">{t("depositAddress")}</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <span dir="ltr" className="flex-1 break-all font-mono text-xs text-foreground" data-testid="deposit-address">
              {selected.address}
            </span>
            <button
              type="button"
              onClick={copyAddress}
              className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent transition hover:bg-accent/20"
            >
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        </div>
        <dl className="grid w-full grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <div className="flex justify-between gap-2 sm:flex-col">
            <dt className="text-muted">{t("minDepositLabel")}</dt>
            <dd className="font-medium text-foreground">{money(selected.minDeposit)}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:flex-col">
            <dt className="text-muted">{t("confirmationsLabel")}</dt>
            <dd className="font-medium text-foreground">{t("confirmationsValue", { count: selected.confirmations })}</dd>
          </div>
          <div className="flex justify-between gap-2 sm:flex-col">
            <dt className="text-muted">{t("expectedArrival")}</dt>
            <dd className="font-medium text-foreground">{t("arrivalValue", { minutes: estimatedMinutes(selected.id, selected.confirmations) })}</dd>
          </div>
        </dl>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3" role="note">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-warning" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="flex flex-col gap-1 text-xs text-warning/90">
          <p>{t("sendOnlyWarning", { network: networkLabel(selected.id) })}</p>
          <p>{t("belowMinWarning", { amount: money(selected.minDeposit) })}</p>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <input type="hidden" name="network" value={selected.id} />
        <div>
          <p className="text-sm font-semibold text-foreground">{t("txStepTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("txStepDesc")}</p>
        </div>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          {t("txHashLabel")}
          <input
            name="txHash"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder={t("txHashPlaceholder")}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 font-mono text-sm text-foreground"
          />
        </label>
        {txHash.trim() !== "" && !hashValid && <p className="text-xs text-danger">{t("txHashFormatHint")}</p>}
        {state.error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">{state.error}</p>}
        {submitted && (
          <p
            role="status"
            className={`rounded-lg border px-3 py-2 text-xs ${
              submitted.status === "completed"
                ? "border-success/30 bg-success/10 text-success"
                : submitted.status === "failed"
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-accent/30 bg-accent/10 text-accent"
            }`}
          >
            {submitted.status === "completed"
              ? t("submittedCompleted")
              : submitted.status === "failed"
                ? t("submittedFailed", { reason: t(`reason_${submitted.reason ?? "tx_failed"}`) })
                : submitted.confirmations > 0
                  ? t("submittedPending", { count: submitted.confirmations, required: submitted.required })
                  : t("submittedSearching")}
          </p>
        )}
        <SubmitButton
          disabled={!hashValid}
          pendingLabel={t("verifying")}
          className="rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("submitTx")}
        </SubmitButton>
      </form>
    </div>
  );
}
