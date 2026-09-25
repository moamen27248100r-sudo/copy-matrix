"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { requestWithdrawal } from "@/app/portfolio/actions";
import { CRYPTO_CURRENCIES, networksForCurrency, type DepositNetwork } from "@/lib/deposit-networks";
import { CryptoIcon } from "@/components/CryptoIcon";

// "1000.000000" reads as noise — show whole numbers plain ("1000") and
// only keep decimals when the amount actually has cents ("1000.5").
function formatAmount(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function AmountStep({
  amount,
  setAmount,
  maxAvailable,
  buttonLabel,
  onContinue,
}: {
  amount: string;
  setAmount: (v: string) => void;
  maxAvailable: number;
  buttonLabel: string;
  onContinue?: () => void;
}) {
  const t = useTranslations("Portfolio");
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
        <p className="text-xs text-muted">{t("availableToWithdraw")}</p>
        <p className="mt-1 text-xl font-bold text-foreground" dir="ltr">
          ${formatAmount(maxAvailable)}
        </p>
      </div>

      <p className="text-sm text-muted">{t("enterWithdrawAmount")}</p>

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-lg font-semibold text-muted">USD</span>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setAmount(v);
            }}
            className="w-full bg-transparent text-right text-2xl font-semibold text-foreground outline-none"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setAmount(formatAmount(maxAvailable))}
            className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent transition hover:bg-accent/20"
          >
            {t("maxButton")}
          </button>
        </div>
      </div>

      <div className="mt-auto">
        <button
          type={onContinue ? "button" : "submit"}
          onClick={onContinue}
          disabled={!amount || Number(amount) <= 0 || Number(amount) > maxAvailable}
          className="w-full rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function SecurityModal({
  amount,
  netReceive,
  network,
  walletAddress,
  processing,
  onCancel,
  onConfirm,
}: {
  amount: string;
  netReceive: number;
  network: DepositNetwork;
  walletAddress: string;
  processing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("Portfolio");
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={processing ? undefined : onCancel} aria-hidden="true" />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-t-3xl border-t border-white/10 bg-[#0B132B]/95 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:rounded-3xl sm:border">
        {processing ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-accent/30 border-t-accent" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{t("processingLabel")}</p>
          </div>
        ) : (
          <>
            <p className="text-base font-semibold text-foreground">{t("securityModalTitle")}</p>
            <p className="text-xs text-muted">{t("securityModalDesc")}</p>

            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">{t("amount")}</span>
                <span dir="ltr" className="font-semibold text-foreground">${amount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">{t("chooseNetworkStep")}</span>
                <span className="font-medium text-foreground">{network.network}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-muted">{t("destinationLabel")}</span>
                <span dir="ltr" className="truncate text-xs text-foreground">{walletAddress}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-2">
                <span className="text-muted">{t("netReceiveLabel")}</span>
                <span dir="ltr" className="font-bold text-success">${formatAmount(netReceive)}</span>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              />
              {t("securityConfirmCheckbox")}
            </label>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-full border border-white/10 px-4 py-2.5 text-sm font-medium text-muted transition hover:text-foreground"
              >
                {t("backEditAmount")}
              </button>
              <button
                type="button"
                disabled={!agreed}
                onClick={onConfirm}
                className="flex-1 rounded-full bg-gradient-to-r from-accent to-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("confirmAndSend")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WithdrawFlow({ accountType, maxAvailable }: { accountType: "real" | "demo"; maxAvailable: number }) {
  const t = useTranslations("Portfolio");
  const [amount, setAmount] = useState(maxAvailable > 0 ? formatAmount(maxAvailable) : "");
  const [step, setStep] = useState<"amount" | "destination">("amount");
  const [currencyId, setCurrencyId] = useState<string | null>(null);
  const [network, setNetwork] = useState<DepositNetwork | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [showSecurity, setShowSecurity] = useState(false);
  const [processing, setProcessing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (accountType === "demo") {
    return (
      <form action={requestWithdrawal} className="flex flex-1 flex-col">
        <input type="hidden" name="amount" value={amount} />
        <AmountStep amount={amount} setAmount={setAmount} maxAvailable={maxAvailable} buttonLabel={t("continue")} />
      </form>
    );
  }

  if (step === "amount") {
    return (
      <div className="flex flex-1 flex-col">
        <AmountStep
          amount={amount}
          setAmount={setAmount}
          maxAvailable={maxAvailable}
          buttonLabel={t("continue")}
          onContinue={() => setStep("destination")}
        />
      </div>
    );
  }

  const networks = currencyId ? networksForCurrency(currencyId) : [];
  const feeUsd = network?.feeUsd ?? 0;
  const netReceive = Math.max(0, Number(amount || 0) - feeUsd);

  async function pasteAddress() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setWalletAddress(text.trim());
    } catch {
      // clipboard read unavailable/denied — nothing to do, field stays manually editable
    }
  }

  async function scanQrFromImage(file: File) {
    // Uses the browser's native BarcodeDetector where available (Chrome/
    // Edge) instead of pulling in a QR-decoding dependency — if the API
    // isn't supported, the field is still fully usable via paste/typing.
    const w = window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect: (s: ImageBitmapSource) => Promise<{ rawValue: string }[]> } };
    if (!w.BarcodeDetector) return;
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new w.BarcodeDetector({ formats: ["qr_code"] });
      const results = await detector.detect(bitmap);
      if (results[0]?.rawValue) setWalletAddress(results[0].rawValue.trim());
    } catch {
      // decode failed — leave the field as-is for manual entry
    }
  }

  return (
    <>
      <form
        ref={formRef}
        action={requestWithdrawal}
        className="flex flex-1 flex-col gap-4"
        onSubmit={(e) => {
          if (!processing) {
            // Intercept the real submit: show the security review modal
            // first, and only let the form actually post once the
            // customer has reviewed + confirmed there.
            e.preventDefault();
            setShowSecurity(true);
          }
        }}
      >
        <input type="hidden" name="amount" value={amount} />
        {network && <input type="hidden" name="network" value={network.id} />}
        {walletAddress && <input type="hidden" name="walletAddress" value={walletAddress} />}

        <button
          type="button"
          onClick={() => setStep("amount")}
          className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          {t("backEditAmount")}
        </button>

        {!currencyId ? (
          <>
            <p className="text-sm text-muted">{t("chooseCurrency")}</p>
            <div className="grid grid-cols-3 gap-2.5">
              {CRYPTO_CURRENCIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCurrencyId(c.id)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-2 py-4 backdrop-blur-md transition hover:border-accent/40 hover:bg-white/[0.06]"
                >
                  <CryptoIcon symbol={c.symbol} color={c.color} size={36} />
                  <span className="text-sm font-semibold text-foreground">{c.symbol}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setCurrencyId(null);
                setNetwork(null);
              }}
              className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
            >
              {t("changeNetwork")}
            </button>
            <p className="text-sm text-muted">{t("chooseNetworkStep")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {networks.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNetwork(n)}
                  className={
                    network?.id === n.id
                      ? "flex flex-col items-center gap-1 rounded-xl border border-accent bg-accent/10 px-3 py-3 text-center"
                      : "flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center backdrop-blur-md transition hover:border-accent/40"
                  }
                >
                  <span className="text-sm font-medium text-foreground">{n.currency}</span>
                  <span className="text-[11px] text-muted">{n.network}</span>
                </button>
              ))}
            </div>

            {network && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  {t("walletAddressLabel")}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder={t("walletAddressPlaceholder")}
                      dir="ltr"
                      required
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-foreground backdrop-blur-md"
                    />
                    <button
                      type="button"
                      onClick={pasteAddress}
                      className="shrink-0 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-muted transition hover:text-foreground"
                    >
                      {t("pasteButton")}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t("scanQrButton")}
                      className="flex shrink-0 items-center justify-center rounded-xl border border-white/10 p-2.5 text-muted transition hover:text-foreground"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2" />
                      </svg>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) scanQrFromImage(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </label>

                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 text-sm backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{t("availableToWithdraw")}</span>
                    <span dir="ltr" className="text-foreground">${formatAmount(maxAvailable)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{t("networkFeeLabel")}</span>
                    <span dir="ltr" className="text-foreground">${formatAmount(feeUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-muted">{t("netReceiveLabel")}</span>
                    <span dir="ltr" className="font-bold text-success">${formatAmount(netReceive)}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-auto">
          <button
            type="submit"
            disabled={!network || !walletAddress.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("confirmWithdraw")}
          </button>
        </div>
      </form>

      {showSecurity && network && (
        <SecurityModal
          amount={amount}
          netReceive={netReceive}
          network={network}
          walletAddress={walletAddress}
          processing={processing}
          onCancel={() => setShowSecurity(false)}
          onConfirm={() => {
            setProcessing(true);
            // Brief, purely cosmetic "processing" beat before the actual
            // (already-instant) server action runs — requestWithdrawal
            // applies the withdrawal synchronously either way.
            setTimeout(() => formRef.current?.requestSubmit(), 900);
          }}
        />
      )}
    </>
  );
}
