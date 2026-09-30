import type { Locale } from "@/i18n/locales";

// Only protections the platform genuinely has today: KYC, manual review of
// every withdrawal, the per-copy auto stop-loss (max_drawdown_pct), demo /
// real account separation, and RLS-restricted reads. Deliberately no 2FA.
type Text = { title: string; items: string[] };

const TEXT: Partial<Record<Locale, Text>> & { en: Text } = {
  ar: {
    title: "أمان حسابك",
    items: [
      "توثيق الهوية",
      "مراجعة طلبات السحب قبل تنفيذها",
      "حد خسارة تلقائي لكل نسخة",
      "فصل كامل بين الحساب التجريبي والحقيقي",
      "بياناتك لا يراها غيرك",
    ],
  },
  en: {
    title: "Your account security",
    items: [
      "Identity verification",
      "Withdrawal requests are reviewed before they are processed",
      "An automatic loss limit on every copy",
      "Full separation between demo and real accounts",
      "Your data is visible only to you",
    ],
  },
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

export function AccountSecurity({ locale, className = "" }: { locale: Locale; className?: string }) {
  const t = TEXT[locale] ?? TEXT.en;
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {t.items.map((item) => (
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
