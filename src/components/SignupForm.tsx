"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { signup } from "@/app/auth/actions";
import { isValidEmailFormat, isValidPhoneForCountry, isPhoneStillTooShort, stripTrunkZero } from "@/lib/validate-signup";
import { PasswordStrength } from "@/components/PasswordField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { SubmitButton } from "@/components/SubmitButton";

// Names come from the Countries translation namespace (keyed by `iso`), not
// a hardcoded field here, so this list stays in sync with the UI locale.
const COUNTRY_CODES = [
  { code: "+966", iso: "SA" },
  { code: "+20", iso: "EG" },
  { code: "+971", iso: "AE" },
  { code: "+965", iso: "KW" },
  { code: "+974", iso: "QA" },
  { code: "+973", iso: "BH" },
  { code: "+968", iso: "OM" },
  { code: "+962", iso: "JO" },
  { code: "+961", iso: "LB" },
  { code: "+963", iso: "SY" },
  { code: "+964", iso: "IQ" },
  { code: "+970", iso: "PS" },
  { code: "+967", iso: "YE" },
  { code: "+218", iso: "LY" },
  { code: "+216", iso: "TN" },
  { code: "+213", iso: "DZ" },
  { code: "+212", iso: "MA" },
  { code: "+249", iso: "SD" },
  { code: "+222", iso: "MR" },
  { code: "+252", iso: "SO" },
  { code: "+90", iso: "TR" },
  { code: "+1", iso: "US" },
  { code: "+44", iso: "GB" },
  { code: "+49", iso: "DE" },
  { code: "+33", iso: "FR" },
  { code: "+39", iso: "IT" },
  { code: "+34", iso: "ES" },
  { code: "+7", iso: "RU" },
  { code: "+86", iso: "CN" },
  { code: "+91", iso: "IN" },
  { code: "+92", iso: "PK" },
  { code: "+62", iso: "ID" },
  { code: "+60", iso: "MY" },
  { code: "+61", iso: "AU" },
  { code: "+55", iso: "BR" },
  { code: "+27", iso: "ZA" },
];

type Country = (typeof COUNTRY_CODES)[number];

const TZ_TO_ISO: Record<string, string> = {
  "Asia/Riyadh": "SA", "Africa/Cairo": "EG", "Asia/Dubai": "AE", "Asia/Kuwait": "KW", "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH", "Asia/Muscat": "OM", "Asia/Amman": "JO", "Asia/Beirut": "LB", "Asia/Damascus": "SY",
  "Asia/Baghdad": "IQ", "Asia/Gaza": "PS", "Asia/Hebron": "PS", "Asia/Aden": "YE", "Africa/Tripoli": "LY",
  "Africa/Tunis": "TN", "Africa/Algiers": "DZ", "Africa/Casablanca": "MA", "Africa/Khartoum": "SD",
  "Africa/Nouakchott": "MR", "Africa/Mogadishu": "SO", "Europe/Istanbul": "TR", "Europe/London": "GB",
  "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Rome": "IT", "Europe/Madrid": "ES", "Europe/Moscow": "RU",
  "Asia/Shanghai": "CN", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Jakarta": "ID",
  "Asia/Kuala_Lumpur": "MY", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "America/Sao_Paulo": "BR",
  "Africa/Johannesburg": "ZA", "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US",
};
const LANG_TO_ISO: Record<string, string> = {
  ar: "SA", en: "US", fr: "FR", es: "ES", pt: "BR", hi: "IN", ur: "PK", id: "ID", zh: "CN", ru: "RU", tr: "TR", de: "DE", it: "IT",
};

// Best guess for the visitor's country: time zone first (where they are), then
// the region in the browser language (en-GB), then the bare language.
function detectCountry(): Country | null {
  const find = (iso?: string) => COUNTRY_CODES.find((c) => c.iso === iso) ?? null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byTz = find(TZ_TO_ISO[tz]);
    if (byTz) return byTz;
  } catch {
    /* ignore */
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    const m = l.match(/[-_]([A-Za-z]{2})$/);
    const byRegion = m ? find(m[1].toUpperCase()) : null;
    if (byRegion) return byRegion;
  }
  return find(LANG_TO_ISO[(langs[0] ?? "").slice(0, 2).toLowerCase()]);
}

function CountryCodeSelect({ country, onChange }: { country: Country; onChange: (c: Country) => void }) {
  const t = useTranslations("Auth");
  const tc = useTranslations("Countries");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-[5.5rem] shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("countryCodeAria")}
        aria-expanded={open}
        className="flex h-full w-full items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface px-2 py-3 text-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://flagcdn.com/24x18/${country.iso.toLowerCase()}.png`} alt="" className="h-3.5 w-[1.15rem] shrink-0 rounded-[1px] object-cover" />
        <span className="num text-sm text-muted">{country.code}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.5} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute start-0 top-[calc(100%+0.375rem)] z-20 max-h-64 w-64 max-w-[85vw] overflow-y-auto rounded-xl border border-border-strong bg-surface p-1">
          {COUNTRY_CODES.map((c) => (
            <button
              key={c.code + c.iso}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://flagcdn.com/24x18/${c.iso.toLowerCase()}.png`} alt="" className="h-3.5 w-[1.15rem] shrink-0 rounded-[1px] object-cover" />
              <span className="flex-1 truncate">{tc(c.iso as never)}</span>
              <span className="num text-xs text-muted">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const field = "w-full rounded-xl border bg-surface px-3.5 py-3 text-base text-foreground placeholder:text-text-3 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const labelCls = "text-sm font-medium";
const errCls = "text-sm text-down";

export function SignupForm({ next }: { next?: string | null }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const [country, setCountry] = useState<Country>(COUNTRY_CODES[0]);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [nationalNumber, setNationalNumber] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirm, setConfirm] = useState("");

  // Pick the country code from the visitor's time zone / browser language
  // instead of always defaulting to Saudi Arabia.
  useEffect(() => {
    const detected = detectCountry();
    if (detected) setCountry(detected);
  }, []);

  const nameValid = name.trim().length >= 2;
  const mismatch = confirm.length > 0 && password !== confirm;
  const emailValid = isValidEmailFormat(email);
  const phoneValid = isValidPhoneForCountry(nationalNumber, country.iso);
  const phoneStillTyping = isPhoneStillTooShort(nationalNumber, country.iso);
  const passwordValid = password.length >= 6;
  const confirmValid = confirm.length > 0 && !mismatch;
  const showPhoneError = phoneTouched && nationalNumber.length > 0 && !phoneStillTyping && !phoneValid;
  const canSubmit = nameValid && emailValid && phoneValid && passwordValid && confirmValid;

  const missing = [
    !nameValid && t("missingName"),
    !emailValid && t("missingEmail"),
    !phoneValid && t("missingPhone"),
    !passwordValid && t("missingPassword"),
    passwordValid && !confirmValid && t("missingConfirm"),
  ].filter(Boolean) as string[];

  return (
    <form action={signup} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-name" className={labelCls}>
          {t("nameLabel")}
        </label>
        <input
          id="su-name"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          aria-invalid={nameTouched && !nameValid ? true : undefined}
          aria-describedby="su-name-err"
          className={`${field} ${nameTouched && !nameValid ? "border-down" : "border-border-strong"}`}
        />
        {nameTouched && !nameValid && (
          <p id="su-name-err" className={errCls}>
            {t("nameRequiredError")}
          </p>
        )}
      </div>

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          aria-invalid={emailTouched && email.length > 0 && !emailValid ? true : undefined}
          aria-describedby="su-email-err"
          className={`${field} text-start ${emailTouched && email.length > 0 && !emailValid ? "border-down" : "border-border-strong"}`}
        />
        {emailTouched && email.length > 0 && !emailValid && (
          <p id="su-email-err" className={errCls}>
            {t("emailInvalidError")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-phone" className={labelCls}>
          {t("phoneLabel")}
        </label>
        <div className="flex gap-2" dir="ltr">
          <CountryCodeSelect country={country} onChange={setCountry} />
          <input type="hidden" name="phoneCountryCode" value={country.code} />
          <input type="hidden" name="phoneCountryIso" value={country.iso} />
          <input
            id="su-phone"
            name="phoneNumber"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={nationalNumber}
            onChange={(e) => setNationalNumber(stripTrunkZero(e.target.value.replace(/\D/g, "")))}
            onBlur={() => setPhoneTouched(true)}
            placeholder={t("phoneLabel")}
            required
            aria-invalid={showPhoneError ? true : undefined}
            aria-describedby="su-phone-err"
            className={`${field} min-w-0 flex-1 ${showPhoneError ? "border-down" : "border-border-strong"}`}
          />
        </div>
        {showPhoneError && (
          <p id="su-phone-err" className={errCls}>
            {t("phoneInvalidError")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-password" className={labelCls}>
          {t("passwordLabel")}
        </label>
        <PasswordInput
          id="su-password"
          name="password"
          placeholder={t("passwordPlaceholder6")}
          minLength={6}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setPasswordTouched(true);
          }}
          invalid={passwordTouched && password.length > 0 && !passwordValid}
          describedBy="su-password-err"
          autoComplete="new-password"
        />
        {passwordTouched && password.length > 0 && !passwordValid && (
          <p id="su-password-err" className={errCls}>
            {t("passwordTooShortError")}
          </p>
        )}
        <PasswordStrength value={password} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="su-confirm" className={labelCls}>
          {t("confirmLabel")}
        </label>
        <PasswordInput
          id="su-confirm"
          name="passwordConfirm"
          placeholder=""
          value={confirm}
          onChange={setConfirm}
          invalid={mismatch}
          describedBy="su-confirm-err"
          autoComplete="new-password"
        />
        {mismatch && (
          <p id="su-confirm-err" className={errCls}>
            {t("passwordMismatch")}
          </p>
        )}
      </div>

      <SubmitButton
        disabled={!canSubmit}
        pendingLabel={t("creatingAccount")}
        className={`rounded-xl px-4 py-3 text-base font-medium transition-colors ${
          canSubmit
            ? "bg-primary text-white hover:bg-accent-hover"
            : "cursor-not-allowed border border-border-strong bg-surface-2 text-muted"
        }`}
      >
        {t("createAccountButton")}
      </SubmitButton>
      {!canSubmit && missing.length > 0 && (
        <p className="text-sm leading-6 text-muted" aria-live="polite">
          {t("missingPrefix")} {new Intl.ListFormat(locale, { type: "conjunction" }).format(missing)}.
        </p>
      )}
    </form>
  );
}
