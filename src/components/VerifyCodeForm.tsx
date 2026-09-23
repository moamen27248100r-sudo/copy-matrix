"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { verifyResetCode } from "@/app/auth/actions";
import { SubmitButton } from "@/components/SubmitButton";

export function VerifyCodeForm({ email }: { email: string }) {
  const t = useTranslations("Auth");
  const [code, setCode] = useState("");

  return (
    <form action={verifyResetCode} className="flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      <input
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="00000000"
        required
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
        dir="ltr"
        className="rounded border border-border bg-surface px-3 py-2 text-center text-2xl tracking-[0.35em]"
      />
      <SubmitButton disabled={code.length !== 8} pendingLabel={t("verifying")}>
        {t("confirmCode")}
      </SubmitButton>
    </form>
  );
}
