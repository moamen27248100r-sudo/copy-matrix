"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { requestDeposit } from "@/app/portfolio/actions";
import { DEPOSIT_NETWORKS, type DepositNetwork } from "@/lib/deposit-networks";

export function DepositGateway() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DepositNetwork | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!selected) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(selected.address, { width: 200, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  function reset() {
    setOpen(false);
    setSelected(null);
    setAmount("");
    setCopied(false);
  }

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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
      >
        إيداع
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">إيداع عبر العملات الرقمية</h3>
        <button type="button" onClick={reset} aria-label="إغلاق" className="text-muted hover:text-foreground">
          ✕
        </button>
      </div>

      {!selected ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DEPOSIT_NETWORKS.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n)}
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface px-3 py-3 text-center transition hover:border-accent"
            >
              <span className="text-sm font-medium text-foreground">{n.currency}</span>
              <span className="text-[11px] text-muted">{n.network}</span>
            </button>
          ))}
        </div>
      ) : (
        <form action={requestDeposit} className="flex flex-col gap-4">
          <input type="hidden" name="network" value={selected.id} />
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            ← تغيير الشبكة
          </button>

          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4">
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`رمز QR لعنوان ${selected.label}`} width={160} height={160} className="rounded bg-white p-2" />
            )}
            <div className="w-full">
              <p className="text-center text-xs text-muted">
                أرسل {selected.currency} فقط عبر شبكة {selected.network} إلى العنوان التالي
              </p>
              <div className="mt-2 flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
                <span dir="ltr" className="flex-1 truncate text-xs text-foreground">
                  {selected.address}
                </span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="shrink-0 rounded border border-border px-2 py-1 text-[11px] text-muted hover:border-accent hover:text-foreground"
                >
                  {copied ? "تم النسخ" : "نسخ"}
                </button>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-center text-[11px] text-muted">
              <span>الحد الأدنى: {selected.minDeposit} {selected.currency}</span>
              <span>تأكيدات الشبكة: {selected.confirmations}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              name="amount"
              type="number"
              step="any"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`المبلغ المُرسَل بالدولار`}
              required
              className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>

          <p className="text-xs text-muted">
            بعد إرسال المبلغ إلى العنوان أعلاه، اضغط «لقد أرسلت المبلغ» — وسينعكس المبلغ على رصيدك فورًا.
          </p>

          <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover">
            لقد أرسلت المبلغ
          </button>
        </form>
      )}
    </div>
  );
}
