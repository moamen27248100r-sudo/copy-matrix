"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ShieldCheck } from "lucide-react";
import {
  confirmTotpEnrollment,
  disableTotp,
  startTotpEnrollment,
  type MfaFormState,
  type TotpEnrollment,
} from "@/app/auth/mfa-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { TotpCodeInput } from "@/components/auth/TotpCodeInput";

const primaryButton =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButton =
  "rounded-xl border border-down/50 bg-down/10 px-4 py-2.5 text-sm font-medium text-down transition hover:bg-down/20 disabled:cursor-not-allowed disabled:opacity-50";

function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-3 py-2 text-sm text-foreground">
      {message}
    </p>
  );
}

// Two-factor (TOTP) on/off for the account security page. `enabled` comes
// from the server (verified factor on the user); every step runs through
// Supabase Auth MFA in app/auth/mfa-actions.ts.
export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const t = useTranslations("TwoFactor");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();

  function beginEnrollment() {
    setNotice(null);
    setStartError(null);
    startTransition(async () => {
      const result = await startTotpEnrollment();
      if ("error" in result) setStartError(result.error);
      else setEnrollment(result);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-foreground/70">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="flex-1 font-medium">{t("title")}</h2>
        <span
          className={
            enabled
              ? "rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-[10px] font-semibold text-up"
              : "rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted"
          }
        >
          {enabled ? t("statusOn") : t("statusOff")}
        </span>
      </div>

      <p className="text-muted">{enabled ? t("descOn") : t("descOff")}</p>

      {notice && (
        <p role="status" className="rounded-xl border border-up/40 bg-up/10 px-3 py-2 text-foreground">
          {notice}
        </p>
      )}

      {enabled ? (
        disabling ? (
          <DisableForm
            onCancel={() => setDisabling(false)}
            onDone={() => {
              setDisabling(false);
              setNotice(t("disabledSuccess"));
            }}
          />
        ) : (
          <div>
            <button
              type="button"
              className={dangerButton}
              onClick={() => {
                setNotice(null);
                setDisabling(true);
              }}
            >
              {t("disable")}
            </button>
          </div>
        )
      ) : enrollment ? (
        <EnrollForm
          key={enrollment.factorId}
          enrollment={enrollment}
          onCancel={() => setEnrollment(null)}
          onDone={() => {
            setEnrollment(null);
            setNotice(t("enabledSuccess"));
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ErrorNote message={startError} />
          <div>
            <button type="button" className={primaryButton} onClick={beginEnrollment} disabled={starting}>
              {starting ? t("preparing") : t("enable")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function EnrollForm({
  enrollment,
  onCancel,
  onDone,
}: {
  enrollment: TotpEnrollment;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("TwoFactor");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [state, formAction] = useActionState<MfaFormState, FormData>(async (prev, formData) => {
    const result = await confirmTotpEnrollment(prev, formData);
    if (result.ok) onDone();
    return result;
  }, {});

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked -- the key is still selectable on screen.
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="factorId" value={enrollment.factorId} />

      <ol className="flex list-decimal flex-col gap-4 ps-5">
        <li className="flex flex-col gap-3">
          <span>{t("stepScan")}</span>
          {/* Supabase returns the QR code as an SVG data URI. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt={t("qrAlt")}
            width={176}
            height={176}
            className="h-44 w-44 rounded-xl bg-white p-2"
          />
          <a href={enrollment.uri} className="text-sm text-primary underline underline-offset-4 sm:hidden">
            {t("openInApp")}
          </a>
        </li>
        <li className="flex flex-col gap-2">
          <span>{t("stepManual")}</span>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 break-all rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs tracking-wider select-all">
              {enrollment.secret.match(/.{1,4}/g)?.join(" ")}
            </code>
            <button type="button" onClick={copySecret} className={secondaryButton} aria-label={t("copyKey")}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          {copied && <span className="text-xs text-up">{t("copied")}</span>}
        </li>
        <li className="flex flex-col gap-3">
          <span>{t("stepConfirm")}</span>
          <TotpCodeInput id="mfa-enroll-code" label={t("codeLabel")} value={code} onChange={setCode} />
        </li>
      </ol>

      <ErrorNote message={state.error} />

      <div className="flex flex-wrap gap-2">
        <SubmitButton disabled={code.length !== 6} pendingLabel={t("verifying")} className={primaryButton}>
          {t("confirmEnable")}
        </SubmitButton>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function DisableForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const t = useTranslations("TwoFactor");
  const [code, setCode] = useState("");
  const [state, formAction] = useActionState<MfaFormState, FormData>(async (prev, formData) => {
    const result = await disableTotp(prev, formData);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p>{t("disablePrompt")}</p>
      <TotpCodeInput id="mfa-disable-code" label={t("codeLabel")} value={code} onChange={setCode} autoFocus />
      <ErrorNote message={state.error} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton disabled={code.length !== 6} pendingLabel={t("verifying")} className={dangerButton}>
          {t("confirmDisable")}
        </SubmitButton>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
