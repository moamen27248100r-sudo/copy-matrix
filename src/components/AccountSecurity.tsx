import { useTranslations } from "next-intl";

// Only protections the platform genuinely has today: KYC, manual review of
// every withdrawal, the per-copy auto stop-loss (max_drawdown_pct), demo /
// real account separation, and RLS-restricted reads. Deliberately no 2FA.
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

export function AccountSecurity({ className = "" }: { className?: string }) {
  const t = useTranslations("AccountSecurity");
  const items = t.raw("items") as string[];
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-xl border border-glass-border bg-glass-surface p-3.5 backdrop-blur-xl"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <CheckIcon />
            </span>
            <span className="min-w-0 text-[13px] font-medium text-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
