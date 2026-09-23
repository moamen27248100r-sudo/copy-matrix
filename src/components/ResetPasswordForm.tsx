"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updatePassword } from "@/app/auth/actions";
import { PasswordStrength, EyeIcon } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";

// New password + confirm, same validation/eye-toggle/strength-meter pattern
// as SignupForm's password fields, plus a pending submit button so tapping
// "update" twice can't fire the update twice.
export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && confirm.length > 0 && !mismatch;

  return (
    <form action={updatePassword} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("newPasswordPlaceholder6")}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 pr-9 pl-9 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        <PasswordStrength value={password} />
      </div>

      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <input
          name="passwordConfirm"
          type={showConfirm ? "text" : "password"}
          placeholder={t("confirmNewPasswordPlaceholder")}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 pr-9 pl-9 text-sm"
        />
        <button
          type="button"
          onClick={() => setShowConfirm((v) => !v)}
          aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        >
          <EyeIcon open={showConfirm} />
        </button>
      </div>
      {mismatch && <p className="text-xs text-danger">{t("passwordMismatch")}</p>}

      <SubmitButton disabled={!canSubmit} pendingLabel={t("updating")}>
        {t("updatePasswordButton")}
      </SubmitButton>
    </form>
  );
}
