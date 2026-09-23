"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { signup } from "@/app/auth/actions";
import { isValidEmailFormat, isValidPhoneForCountry, isPhoneStillTooShort, stripTrunkZero } from "@/lib/validate-signup";
import { PasswordStrength, EyeIcon } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";

// Names come from the Countries translation namespace (keyed by `iso`), not
// a hardcoded field here, so this list stays in sync with the UI locale.
const COUNTRY_CODES = [
  { code: "+966", flag: "🇸🇦", iso: "SA" },
  { code: "+20", flag: "🇪🇬", iso: "EG" },
  { code: "+971", flag: "🇦🇪", iso: "AE" },
  { code: "+965", flag: "🇰🇼", iso: "KW" },
  { code: "+974", flag: "🇶🇦", iso: "QA" },
  { code: "+973", flag: "🇧🇭", iso: "BH" },
  { code: "+968", flag: "🇴🇲", iso: "OM" },
  { code: "+962", flag: "🇯🇴", iso: "JO" },
  { code: "+961", flag: "🇱🇧", iso: "LB" },
  { code: "+963", flag: "🇸🇾", iso: "SY" },
  { code: "+964", flag: "🇮🇶", iso: "IQ" },
  { code: "+970", flag: "🇵🇸", iso: "PS" },
  { code: "+967", flag: "🇾🇪", iso: "YE" },
  { code: "+218", flag: "🇱🇾", iso: "LY" },
  { code: "+216", flag: "🇹🇳", iso: "TN" },
  { code: "+213", flag: "🇩🇿", iso: "DZ" },
  { code: "+212", flag: "🇲🇦", iso: "MA" },
  { code: "+249", flag: "🇸🇩", iso: "SD" },
  { code: "+222", flag: "🇲🇷", iso: "MR" },
  { code: "+252", flag: "🇸🇴", iso: "SO" },
  { code: "+90", flag: "🇹🇷", iso: "TR" },
  { code: "+1", flag: "🇺🇸", iso: "US" },
  { code: "+44", flag: "🇬🇧", iso: "GB" },
  { code: "+49", flag: "🇩🇪", iso: "DE" },
  { code: "+33", flag: "🇫🇷", iso: "FR" },
  { code: "+39", flag: "🇮🇹", iso: "IT" },
  { code: "+34", flag: "🇪🇸", iso: "ES" },
  { code: "+7", flag: "🇷🇺", iso: "RU" },
  { code: "+86", flag: "🇨🇳", iso: "CN" },
  { code: "+91", flag: "🇮🇳", iso: "IN" },
  { code: "+92", flag: "🇵🇰", iso: "PK" },
  { code: "+62", flag: "🇮🇩", iso: "ID" },
  { code: "+60", flag: "🇲🇾", iso: "MY" },
  { code: "+61", flag: "🇦🇺", iso: "AU" },
  { code: "+55", flag: "🇧🇷", iso: "BR" },
  { code: "+27", flag: "🇿🇦", iso: "ZA" },
];

// PasswordStrength and EyeIcon moved to @/components/PasswordField (also used
// by ResetPasswordForm).

type Country = (typeof COUNTRY_CODES)[number];

function CountryCodeSelect({ country, onChange }: { country: Country; onChange: (c: Country) => void }) {
  const t = useTranslations("Auth");
  const tc = useTranslations("Countries");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-[4.75rem] shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("countryCodeAria")}
        className="flex w-full items-center justify-center gap-1 rounded border border-border bg-background px-1.5 py-2 text-sm"
      >
        <img
          src={`https://flagcdn.com/24x18/${country.iso.toLowerCase()}.png`}
          alt=""
          className="h-3.5 w-[1.15rem] shrink-0 rounded-[1px] object-cover"
        />
        <span className="text-xs text-muted">{country.iso}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute start-0 top-[calc(100%+0.375rem)] z-20 max-h-64 w-64 max-w-[85vw] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
          {COUNTRY_CODES.map((c) => (
            <button
              key={c.code + c.iso}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-background"
            >
              <img
                src={`https://flagcdn.com/24x18/${c.iso.toLowerCase()}.png`}
                alt=""
                className="h-3.5 w-[1.15rem] shrink-0 rounded-[1px] object-cover"
              />
              <span className="flex-1 truncate">{tc(c.iso as never)}</span>
              <span className="text-xs text-muted" dir="ltr">
                {c.code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SignupForm({ next }: { next?: string | null }) {
  const t = useTranslations("Auth");
  const [country, setCountry] = useState<Country>(COUNTRY_CODES[0]);
  const [nationalNumber, setNationalNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const emailValid = isValidEmailFormat(email);
  const phoneValid = isValidPhoneForCountry(nationalNumber, country.iso);
  const phoneStillTyping = isPhoneStillTooShort(nationalNumber, country.iso);
  const showPhoneError = phoneTouched && nationalNumber.length > 0 && !phoneStillTyping && !phoneValid;
  const canSubmit = password.length >= 6 && !mismatch && emailValid && phoneValid;

  return (
    <form action={signup} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
        </svg>
        <input
          name="displayName"
          type="text"
          placeholder={t("fullNamePlaceholder")}
          required
          className="w-full rounded border border-border bg-background px-3 py-2 pr-9 text-sm"
        />
      </div>

      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 7l10 6 10-6" />
        </svg>
        <input
          name="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          className="w-full rounded border border-border bg-background px-3 py-2 pr-9 text-sm"
        />
      </div>
      {emailTouched && email.length > 0 && !emailValid && (
        <p className="-mt-2 text-xs text-danger">{t("emailInvalidError")}</p>
      )}

      <div className="flex gap-2">
        <CountryCodeSelect country={country} onChange={setCountry} />
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <input type="hidden" name="phoneCountryCode" value={country.code} />
          <input type="hidden" name="phoneCountryIso" value={country.iso} />
          <div
            dir="ltr"
            className="flex w-full items-center gap-1.5 rounded border border-border bg-background py-2 pl-3 pr-9 text-sm"
          >
            <span className="shrink-0 text-muted">{country.code}</span>
            <input
              name="phoneNumber"
              type="tel"
              inputMode="numeric"
              value={nationalNumber}
              onChange={(e) => setNationalNumber(stripTrunkZero(e.target.value.replace(/\D/g, "")))}
              onBlur={() => setPhoneTouched(true)}
              placeholder="xxxxxxxxx"
              required
              className="w-full min-w-0 bg-transparent outline-none"
            />
          </div>
        </div>
      </div>
      {showPhoneError && (
        <p className="-mt-2 text-xs text-danger">{t("phoneInvalidError")}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder={t("passwordPlaceholder6")}
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
          placeholder={t("confirmPasswordPlaceholder")}
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

      <SubmitButton disabled={!canSubmit} pendingLabel={t("creatingAccount")}>
        {t("createAccountButton")}
      </SubmitButton>
    </form>
  );
}
