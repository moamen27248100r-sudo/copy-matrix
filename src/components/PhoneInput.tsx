"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { isValidPhoneForCountry, isPhoneStillTooShort, stripTrunkZero } from "@/lib/validate-signup";

// Names come from the Countries translation namespace (keyed by `iso`), not
// a hardcoded field here, so this list stays in sync with the UI locale.
export const COUNTRY_CODES = [
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

export type Country = (typeof COUNTRY_CODES)[number];

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
export function detectCountry(): Country | null {
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

export function CountryCodeSelect({ country, onChange }: { country: Country; onChange: (c: Country) => void }) {
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
        aria-label={`${t("countryCodeAria")} ${country.code}`}
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


const field = "w-full rounded border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

// Country code + national number. The form receives the country code, the country and the digits;
// the server builds the E.164 number from them and checks it again (libphonenumber).
export function PhoneInput({ defaultNumber = "", label, errorText }: { defaultNumber?: string; label: string; errorText: string }) {
  const [country, setCountry] = useState<Country>(COUNTRY_CODES[0]);
  const [national, setNational] = useState(defaultNumber);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const detected = detectCountry();
      if (detected) setCountry(detected);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const valid = isValidPhoneForCountry(national, country.iso);
  const showError = touched && national.length > 0 && !isPhoneStillTooShort(national, country.iso) && !valid;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="ph-number" className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2" dir="ltr">
        <CountryCodeSelect country={country} onChange={setCountry} />
        <input type="hidden" name="phoneCountryCode" value={country.code} />
        <input type="hidden" name="phoneCountryIso" value={country.iso} />
        <input
          id="ph-number"
          name="phoneNumber"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => setNational(stripTrunkZero(e.target.value.replace(/\D/g, "")))}
          onBlur={() => setTouched(true)}
          aria-invalid={showError || undefined}
          aria-describedby="ph-err"
          className={`${field} min-w-0 flex-1 ${showError ? "border-danger" : "border-border"}`}
        />
      </div>
      <p id="ph-err" aria-live="polite" className="min-h-0 text-xs text-danger">
        {showError ? errorText : ""}
      </p>
    </div>
  );
}
