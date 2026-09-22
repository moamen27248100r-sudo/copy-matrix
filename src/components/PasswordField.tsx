// Shared password-input building blocks: the strength meter and the
// show/hide eye toggle icon, used by SignupForm and ResetPasswordForm so both
// forms look and behave identically.

export function PasswordStrength({ value }: { value: string }) {
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

export function EyeIcon({ open }: { open: boolean }) {
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
