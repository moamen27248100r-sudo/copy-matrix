"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { refreshMyDeposits } from "@/app/portfolio/actions";

const TONE: Record<string, string> = {
  completed: "border-success/40 text-success",
  failed: "border-danger/40 text-danger",
  rejected: "border-danger/40 text-danger",
  cancelled: "border-border text-muted",
  pending: "border-warning/40 text-warning",
  processing: "border-warning/40 text-warning",
  sending: "border-accent/40 text-accent",
};

/** Status chip for a deposit (pending / completed / failed) or a withdrawal. */
export function WalletStatusBadge({
  status,
  confirmations,
  required,
}: {
  status: string;
  confirmations?: number;
  required?: number;
}) {
  const t = useTranslations("Wallet");
  const label =
    status === "pending"
      ? confirmations
        ? t("statusAwaitingConfirmations", { count: confirmations, required: required ?? confirmations })
        : t("statusVerifying")
      : ({
          completed: t("statusCompleted"),
          failed: t("statusFailed"),
          processing: t("statusProcessing"),
          sending: t("statusSending"),
          rejected: t("statusRejected"),
          cancelled: t("statusCancelled"),
        } as Record<string, string>)[status] ?? status;
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-medium ${TONE[status] ?? "border-border text-muted"}`}>
      {label}
    </span>
  );
}

/** While a deposit waits for confirmations, re-check it every 15 s and refresh the page. */
export function PendingDepositsRefresher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(async () => {
      try {
        await refreshMyDeposits();
      } finally {
        router.refresh();
      }
    }, 15000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
