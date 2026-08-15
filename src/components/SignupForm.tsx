"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signup } from "@/app/auth/actions";

const COUNTRY_CODES = [
  { code: "+966", name: "السعودية", flag: "🇸🇦", iso: "SA" },
  { code: "+20", name: "مصر", flag: "🇪🇬", iso: "EG" },
  { code: "+971", name: "الإمارات", flag: "🇦🇪", iso: "AE" },
  { code: "+965", name: "الكويت", flag: "🇰🇼", iso: "KW" },
  { code: "+974", name: "قطر", flag: "🇶🇦", iso: "QA" },
  { code: "+973", name: "البحرين", flag: "🇧🇭", iso: "BH" },
  { code: "+968", name: "عُمان", flag: "🇴🇲", iso: "OM" },
  { code: "+962", name: "الأردن", flag: "🇯🇴", iso: "JO" },
  { code: "+961", name: "لبنان", flag: "🇱🇧", iso: "LB" },
  { code: "+963", name: "سوريا", flag: "🇸🇾", iso: "SY" },
  { code: "+964", name: "العراق", flag: "🇮🇶", iso: "IQ" },
  { code: "+970", name: "فلسطين", flag: "🇵🇸", iso: "PS" },
  { code: "+967", name: "اليمن", flag: "🇾🇪", iso: "YE" },
  { code: "+218", name: "ليبيا", flag: "🇱🇾", iso: "LY" },
  { code: "+216", name: "تونس", flag: "🇹🇳", iso: "TN" },
  { code: "+213", name: "الجزائر", flag: "🇩🇿", iso: "DZ" },
  { code: "+212", name: "المغرب", flag: "🇲🇦", iso: "MA" },
  { code: "+249", name: "السودان", flag: "🇸🇩", iso: "SD" },
  { code: "+222", name: "موريتانيا", flag: "🇲🇷", iso: "MR" },
  { code: "+252", name: "الصومال", flag: "🇸🇴", iso: "SO" },
  { code: "+90", name: "تركيا", flag: "🇹🇷", iso: "TR" },
  { code: "+1", name: "الولايات المتحدة", flag: "🇺🇸", iso: "US" },
  { code: "+44", name: "المملكة المتحدة", flag: "🇬🇧", iso: "GB" },
  { code: "+49", name: "ألمانيا", flag: "🇩🇪", iso: "DE" },
  { code: "+33", name: "فرنسا", flag: "🇫🇷", iso: "FR" },
  { code: "+39", name: "إيطاليا", flag: "🇮🇹", iso: "IT" },
  { code: "+34", name: "إسبانيا", flag: "🇪🇸", iso: "ES" },
  { code: "+7", name: "روسيا", flag: "🇷🇺", iso: "RU" },
  { code: "+86", name: "الصين", flag: "🇨🇳", iso: "CN" },
  { code: "+91", name: "الهند", flag: "🇮🇳", iso: "IN" },
  { code: "+92", name: "باكستان", flag: "🇵🇰", iso: "PK" },
  { code: "+62", name: "إندونيسيا", flag: "🇮🇩", iso: "ID" },
  { code: "+60", name: "ماليزيا", flag: "🇲🇾", iso: "MY" },
  { code: "+61", name: "أستراليا", flag: "🇦🇺", iso: "AU" },
  { code: "+55", name: "البرازيل", flag: "🇧🇷", iso: "BR" },
  { code: "+27", name: "جنوب أفريقيا", flag: "🇿🇦", iso: "ZA" },
];

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score =
    (value.length >= 6 ? 1 : 0) +
    (value.length >= 10 ? 1 : 0) +
    (/[a-z]/.test(value) && /[A-Z]/.test(value) ? 1 : 0) +
    (/[0-9]/.test(value) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(value) ? 1 : 0);
  const level = score <= 1 ? 0 : score <= 3 ? 1 : 2;
  const labels = ["ضعيفة", "متوسطة", "قوية"];
  const colors = ["bg-danger", "bg-warning", "bg-success"];

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-full flex-1 rounded-full ${i <= level ? colors[level] : "bg-border"}`} />
        ))}
      </div>
      <span className="w-12 shrink-0 text-xs text-muted">{labels[level]}</span>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {open ? (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M1 1l22 22" />
        </>
      )}
    </svg>
  );
}

function CountryCodeSelect() {
  const [country, setCountry] = useState(COUNTRY_CODES[0]);
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
    <div className="relative w-24 shrink-0" ref={ref}>
      <input type="hidden" name="phoneCountryCode" value={country.code} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="اختر مفتاح الدولة"
        className="flex w-full items-center justify-between gap-1 rounded border border-border bg-background px-2 py-2 text-sm"
      >
        <span className="flex items-center gap-1 truncate">
          <span>{country.flag}</span>
          <span className="text-xs text-muted">{country.iso}</span>
          <span dir="ltr">{country.code}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
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
              key={c.code + c.name}
              type="button"
              onClick={() => {
                setCountry(c);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-background"
            >
              <span>{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
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

export function SignupForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = agreed && password.length >= 6 && !mismatch;

  return (
    <form action={signup} className="flex flex-col gap-3">
      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
        </svg>
        <input
          name="displayName"
          type="text"
          placeholder="الاسم الكامل"
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
          placeholder="البريد الإلكتروني"
          required
          className="w-full rounded border border-border bg-background px-3 py-2 pr-9 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <CountryCodeSelect />
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <input
            name="phoneNumber"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="رقم الهاتف"
            required
            className="w-full rounded border border-border bg-background px-3 py-2 pr-9 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="كلمة المرور (٦ أحرف على الأقل)"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 pr-9 pl-9 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
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
          placeholder="تأكيد كلمة المرور"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 pr-9 pl-9 text-sm"
        />
        <button
          type="button"
          onClick={() => setShowConfirm((v) => !v)}
          aria-label={showConfirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        >
          <EyeIcon open={showConfirm} />
        </button>
      </div>
      {mismatch && <p className="text-xs text-danger">كلمتا المرور غير متطابقتين.</p>}

      <label className="flex items-start gap-2 text-xs text-muted">
        <input
          type="checkbox"
          required
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
        />
        <span>
          أوافق على{" "}
          <Link href="/legal/terms" className="underline">
            الشروط والأحكام
          </Link>{" "}
          و{" "}
          <Link href="/legal/privacy" className="underline">
            سياسة الخصوصية
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded bg-accent px-3 py-2.5 font-medium text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        إنشاء حساب
      </button>
    </form>
  );
}
