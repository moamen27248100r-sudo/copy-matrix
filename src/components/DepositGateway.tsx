"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { requestDeposit } from "@/app/portfolio/actions";
import { CRYPTO_CURRENCIES, networksForCurrency, type DepositNetwork } from "@/lib/deposit-networks";
import { CryptoIcon } from "@/components/CryptoIcon";

export function DepositGateway() {
  const t = useTranslations("Portfolio");
  const [currencyId, setCurrencyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DepositNetwork | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");
  const [txId, setTxId] = useState("");

  useEffect(() => {
    if (!selected) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(selected.address, { width: 240, margin: 1, color: { dark: "#0B132B", light: "#ffffff" } }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function copyAddress() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — silently ignore, the address is still selectable by hand
    }
  }

  const currency = CRYPTO_CURRENCIES.find((c) => c.id === currencyId) ?? null;
  const networks = currencyId ? networksForCurrency(currencyId) : [];

  // Step 1: currency grid
  if (!currency) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("chooseCurrency")}</p>
        <div className="grid grid-cols-3 gap-2.5">
          {CRYPTO_CURRENCIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCurrencyId(c.id)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-2 py-4 backdrop-blur-md transition hover:border-accent/40 hover:bg-white/[0.06]"
            >
              <CryptoIcon symbol={c.symbol} color={c.color} size={40} />
              <span className="text-sm font-semibold text-foreground">{c.symbol}</span>
              <span className="text-[11px] text-muted">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: network grid (for the chosen currency)
  if (!selected) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setCurrencyId(null)}
          className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          {t("changeNetwork")}
        </button>
        <div className="flex items-center gap-2">
          <CryptoIcon symbol={currency.symbol} color={currency.color} size={28} />
          <p className="text-sm text-muted">{t("chooseNetworkStep")}</p>
        </div>
        <div className="flex flex-col gap-2">
          {networks.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n)}
              className="relative flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-start backdrop-blur-md transition hover:border-accent/40 hover:bg-white/[0.06]"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{n.network}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  <span dir="ltr">
                    ~{n.estMinutes} {t("minutesShort")}
                  </span>
                  {" · "}
                  {t("networkFeeLabel")} <span dir="ltr">${n.feeUsd}</span>
                </p>
              </div>
              {n.recommended && (
                <span className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-bold text-accent">★</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 3: address/QR + guidelines + amount confirmation
  return (
    <form action={requestDeposit} className="flex flex-1 flex-col gap-4">
      <input type="hidden" name="network" value={selected.id} />
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        {t("changeNetwork")}
      </button>

      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
        {qrDataUrl && (
          <div className="relative rounded-2xl bg-white p-3 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={t("qrAlt", { label: selected.label })} width={200} height={200} />
            <span
              className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white shadow"
              style={{ backgroundColor: currency.color }}
              aria-hidden="true"
            >
              <CryptoIcon symbol={currency.symbol} color={currency.color} size={26} />
            </span>
          </div>
        )}
        <div className="w-full">
          <p className="text-center text-xs text-muted">
            {t("sendOnlyNote", { currency: selected.currency, network: selected.network })}
          </p>
          <div className="relative mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
            <span dir="ltr" className="flex-1 truncate text-xs text-foreground">
              {selected.address}
            </span>
            <button
              type="button"
              onClick={copyAddress}
              className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent transition hover:bg-accent/20"
            >
              {copied ? t("copied") : t("copyAddress")}
            </button>
            {copied && (
              <span className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-success px-3 py-1 text-[11px] font-medium text-background shadow-lg animate-[sort-dropdown-in_150ms_ease-out]">
                {t("copied")}
              </span>
            )}
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 text-center text-[11px] text-muted">
          <span>{t("minDeposit", { amount: selected.minDeposit, currency: selected.currency })}</span>
          <span>{t("networkConfirmations", { count: selected.confirmations })}</span>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-3.5 py-3">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-warning" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-xs text-warning/90">{t("depositWarning")}</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          name="amount"
          type="number"
          step="any"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("amountSentPlaceholder")}
          required
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm backdrop-blur-md"
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        {t("txIdLabel")}
        <input
          name="txId"
          type="text"
          value={txId}
          onChange={(e) => setTxId(e.target.value)}
          placeholder={t("txIdPlaceholder")}
          dir="ltr"
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-foreground backdrop-blur-md"
        />
      </label>

      <p className="text-xs text-muted">{t("afterSendingNote")}</p>

      <button
        type="submit"
        className="rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110"
      >
        {t("iSentAmount")}
      </button>
    </form>
  );
}
