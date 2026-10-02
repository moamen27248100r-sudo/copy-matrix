"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { verifyMfaLogin, type MfaFormState } from "@/app/auth/mfa-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { TotpCodeInput } from "@/components/auth/TotpCodeInput";

export function MfaChallengeForm({ next }: { next: string | null }) {
  const t = useTranslations("TwoFactor");
  const [code, setCode] = useState("");
  const [state, formAction] = useActionState<MfaFormState, FormData>(verifyMfaLogin, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-foreground">
          {state.error}
        </p>
      )}
      <TotpCodeInput id="mfa-code" label={t("codeLabel")} value={code} onChange={setCode} autoFocus />
      <SubmitButton
        disabled={code.length !== 6}
        pendingLabel={t("verifying")}
        className="rounded-xl bg-primary px-4 py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("verify")}
      </SubmitButton>
    </form>
  );
}
