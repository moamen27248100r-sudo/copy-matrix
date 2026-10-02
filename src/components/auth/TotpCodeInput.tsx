"use client";

// Six-digit authenticator code field: digits only, LTR, and autofill-friendly
// (one-time-code) so phone keyboards can offer the code directly.
export function TotpCodeInput({
  id,
  label,
  value,
  onChange,
  autoFocus = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        placeholder="000000"
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        dir="ltr"
        className="w-full rounded-xl border border-border-strong bg-surface px-3.5 py-3 text-center text-2xl tracking-[0.4em] text-foreground placeholder:text-text-3 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </div>
  );
}
