"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

const inputClass =
  "w-full rounded-xl border bg-surface py-3 ps-3.5 pe-11 text-base text-foreground placeholder:text-text-3 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

// Password field with a show/hide toggle (Lucide icons, no per-page SVG copies).
export function PasswordInput({
  name,
  id,
  placeholder,
  value,
  onChange,
  minLength,
  invalid,
  describedBy,
  autoComplete,
}: {
  name: string;
  id: string;
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
  minLength?: number;
  invalid?: boolean;
  describedBy?: string;
  autoComplete?: string;
}) {
  const t = useTranslations("Auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${inputClass} ${invalid ? "border-down" : "border-border-strong"}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t("hidePassword") : t("showPassword")}
        className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-muted hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
      </button>
    </div>
  );
}
