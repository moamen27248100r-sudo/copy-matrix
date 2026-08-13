"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/app/auth/actions";

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
