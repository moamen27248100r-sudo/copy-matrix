"use client";

import { requestPasswordReset } from "@/app/auth/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function ForgotPasswordForm() {
  return (
    <form action={requestPasswordReset} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        placeholder="البريد الإلكتروني"
        required
        className="rounded border border-border bg-surface px-3 py-2"
      />
      <SubmitButton
        pendingLabel="جارٍ الإرسال..."
        className="rounded border border-border bg-surface px-3 py-2 text-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
      >
        إرسال رابط إعادة التعيين
      </SubmitButton>
    </form>
  );
}
