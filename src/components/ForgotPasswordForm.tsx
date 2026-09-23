"use client";

import { useTranslations } from "next-intl";
import { requestPasswordReset } from "@/app/auth/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  return (
    <form action={requestPasswordReset} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        placeholder={t("emailPlaceholder")}
        required
        className="rounded border border-border bg-surface px-3 py-2"
      />
      <SubmitButton
        pendingLabel={t("sending")}
        className="rounded border border-border bg-surface px-3 py-2 text-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("sendResetLink")}
      </SubmitButton>
    </form>
  );
}
