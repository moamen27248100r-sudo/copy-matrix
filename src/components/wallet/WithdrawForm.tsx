"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { requestCryptoWithdrawal, type WithdrawFormState } from "@/app/portfolio/actions";
import { useMoney } from "@/lib/money-client";
import { CHAINS, isValidAddress, networkLabel, type NetworkId } from "@/lib/crypto/networks";
import { CURRENCY } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";
import { NetworkIcon } from "@/components/NetworkIcon";

export type WithdrawNetworkOption = { id: NetworkId; fee: number; minWithdraw: number; dailyLimit: number; dailyUsed: number };

// Amounts are kept to 6 decimals (USDT precision) and rounded down, so "All" never exceeds the balance.
const floor6 = (n: number) => Math.floor(n * 1e6) / 1e6;

export function WithdrawForm({ networks, available }: { networks: WithdrawNetworkOption[]; available: number }) {
  const t = useTranslations("Wallet");
  const money = useMoney();
  const [networkId, setNetworkId] = useState<NetworkId>(networks[0].id);
  const net = networks.find((n) => n.id === networkId) ?? networks[0];
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [state, formAction] = useActionState<WithdrawFormState, FormData>(requestCryptoWithdrawal, {});

  const dailyRemaining = Math.max(0, net.dailyLimit - net.dailyUsed);
  const maxAmount = floor6(Math.min(available, dailyRemaining));
  const value = Number(amount);
  const hasAmount = amount !== "" && Number.isFinite(value) && value > 0;
  const receive = hasAmount ? Math.max(0, value - net.fee) : 0;
  const addressOk = isValidAddress(net.id, address);

  let amountError: string | null = null;
  if (hasAmount) {
    if (value > available) amountError = t("amountAboveAvailable");
    else if (value > dailyRemaining) amountError = t("amountAboveDaily");
    else if (value < net.minWithdraw || value <= net.fee) amountError = t("amountBelowMin", { amount: money(net.minWithdraw) });
  }
  const canSubmit = addressOk && hasAmount && !amountError && /^\d{6}$/.test(code) && agreed;

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setAddress(text.trim());
    } catch {
      // clipboard read denied: the field stays editable
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="network" value={net.id} />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted">{t("networkLabel")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("networkLabel")}>
          {networks.map((n) => (
            <button
              key={n.id}
              type="button"
              role="radio"
              aria-checked={n.id === net.id}
              onClick={() => setNetworkId(n.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start transition ${
                n.id === net.id ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.03] hover:border-accent/40"
              }`}
            >
              <NetworkIcon network={CHAINS[n.id].chainName} size={24} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{n.id}</span>
                <span className="text-[11px] text-muted">
                  {t("feeShort")} {money(n.fee)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-xs text-muted">
        {t("addressLabel")}
        <div className="flex items-center gap-2">
          <input
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder={t("addressPlaceholder", { network: networkLabel(net.id) })}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-foreground"
          />
          <button
            type="button"
            onClick={paste}
            className="shrink-0 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
          >
            {t("paste")}
          </button>
        </div>
      </label>
      {address !== "" && !addressOk && <p className="-mt-3 text-xs text-danger">{t("addressInvalid", { network: networkLabel(net.id) })}</p>}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{t("amountLabel")}</span>
          <span>
            {t("availableLabel")} <span className="text-foreground">{money(available)}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <input
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={t("amountPlaceholder", { amount: money(net.minWithdraw) })}
            dir="ltr"
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-foreground outline-none"
          />
          <span className="text-xs text-muted">{CURRENCY}</span>
          <button
            type="button"
            onClick={() => setAmount(maxAmount > 0 ? String(maxAmount) : "")}
            className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent transition hover:bg-accent/20"
          >
            {t("maxAll")}
          </button>
        </div>
        {amountError && <p className="text-xs text-danger">{amountError}</p>}
      </div>

      <dl className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">{t("minWithdrawLabel")}</dt>
          <dd className="text-foreground">{money(net.minWithdraw)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">{t("dailyRemainingLabel")}</dt>
          <dd className="text-foreground">
            {money(dailyRemaining)} <span className="text-xs text-muted">/ {money(net.dailyLimit)}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">{t("networkFeeLabel")}</dt>
          <dd className="text-foreground">{money(net.fee)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <dt className="text-muted">{t("receiveLabel")}</dt>
          <dd className="font-bold text-success">{money(receive)}</dd>
        </div>
      </dl>

      <label className="flex flex-col gap-1.5 text-xs text-muted">
        {t("codeLabel")}
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          dir="ltr"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-foreground"
        />
        <span>{t("codeHelp")}</span>
      </label>

      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-accent" />
        {t("confirmCheckbox")}
      </label>

      {state.error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">{state.error}</p>}

      <SubmitButton
        disabled={!canSubmit}
        pendingLabel={t("submittingWithdraw")}
        className="rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("submitWithdraw")}
      </SubmitButton>
      <p className="text-center text-[11px] text-muted">{t("processingTime")}</p>
    </form>
  );
}
