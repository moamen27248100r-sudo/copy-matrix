"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signup } from "@/app/auth/actions";
import { isValidEmailFormat } from "@/lib/validate-signup";
import { PasswordStrength } from "@/components/PasswordField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SubmitButton } from "@/components/SubmitButton";

const field =
  "w-full rounded-xl border bg-surface px-3.5 py-3 text-base text-foreground placeholder:text-text-3 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const labelCls = "text-sm font-medium";
const errCls = "text-sm text-down";

// One step: an e-mail and a password. Checked here as you type, and again on the server; whatever the
// server refuses (e-mail already registered, a common or leaked password) comes back as a code and
// is shown under its own field.
export function SignupForm({
  next,
  initialEmail = "",
  serverCode,
  loginHref,
}: {
  next?: string | null;
  initialEmail?: string;
  serverCode?: string | null;
  loginHref: string;
}) {
  const t = useTranslations("Auth");
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = isValidEmailFormat(email);
  const passwordValid = password.length >= 8;
  const canSubmit = emailValid && passwordValid;

  const emailServerError = serverCode === "email_invalid" ? t("emailInvalidError") : serverCode === "email_taken" ? "taken" : null;
  const passwordServerError =
    serverCode === "password_short"
      ? t("passwordMin8Error")
      : serverCode === "password_common"
        ? t("passwordCommonError")
        : serverCode === "password_email"
          ? t("passwordEmailError")
          : serverCode === "password_breached"
            ? t("passwordBreachedError")
            : null;
  const showEmailLocal = emailTouched && email.length > 0 && !emailValid;
  const showPasswordLocal = passwordTouched && password.length > 0 && !passwordValid;
  const emailHasError = showEmailLocal || !!emailServerError;
  const passwordHasError = showPasswordLocal || (!!passwordServerError && password.length === 0);

  return (
    <form action={signup} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-email" className={labelCls}>
          {t("emailLabel")}
        </label>
        <input
          id="su-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          required
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          aria-invalid={emailHasError || undefined}
          aria-describedby="su-email-err"
          className={`${field} text-start ${emailHasError ? "border-down" : "border-border-strong"}`}
        />
        <div id="su-email-err" aria-live="polite">
          {showEmailLocal && <p className={errCls}>{t("emailInvalidError")}</p>}
          {!showEmailLocal && emailServerError === "taken" && (
            <p className={errCls}>
              {t("emailTakenError")}{" "}
              <Link href={loginHref} className="font-medium text-foreground underline underline-offset-4">
                {t("emailTakenLogin")}
              </Link>{" "}
              ·{" "}
              <Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-4">
                {t("emailTakenReset")}
              </Link>
            </p>
          )}
          {!showEmailLocal && emailServerError && emailServerError !== "taken" && <p className={errCls}>{emailServerError}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-password" className={labelCls}>
          {t("passwordLabel")}
        </label>
        <PasswordInput
          id="su-password"
          name="password"
          placeholder={t("passwordPlaceholder8")}
          minLength={8}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setPasswordTouched(true);
          }}
          invalid={passwordHasError}
          describedBy="su-password-err"
          autoComplete="new-password"
        />
        <div id="su-password-err" aria-live="polite">
          {showPasswordLocal && <p className={errCls}>{t("passwordMin8Error")}</p>}
          {!showPasswordLocal && passwordServerError && password.length === 0 && <p className={errCls}>{passwordServerError}</p>}
        </div>
        <PasswordStrength value={password} />
      </div>

      <SubmitButton
        disabled={!canSubmit}
        pendingLabel={t("creatingAccount")}
        className={`rounded-xl px-4 py-3 text-base font-medium transition-colors ${
          canSubmit ? "bg-primary text-white hover:bg-accent-hover" : "cursor-not-allowed border border-border-strong bg-surface-2 text-muted"
        }`}
      >
        {t("createAccountButton")}
      </SubmitButton>
    </form>
  );
}
