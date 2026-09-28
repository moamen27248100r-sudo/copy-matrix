"use client";

import { useTranslations } from "next-intl";

// Shared error state with a retry button (wired to an error boundary's reset).
export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  const t = useTranslations("Common");
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-8 text-center">
      <p className="text-body text-danger">{message ?? t("errorGeneric")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-danger/50 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
      >
        {t("retry")}
      </button>
    </div>
  );
}
