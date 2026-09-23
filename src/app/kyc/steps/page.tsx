import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

export default async function KycStepsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const t = await getTranslations("Kyc");

  const STEPS: {
    n: number;
    title: string;
    benefitsLabel?: string;
    benefits?: string[];
  }[] = [
    {
      n: 1,
      title: t("step1Title"),
      benefitsLabel: t("unlocksLabel"),
      benefits: [t("benefitWithdrawals")],
    },
    {
      n: 2,
      title: t("step2Title"),
    },
    {
      n: 3,
      title: t("step3Title"),
      benefitsLabel: t("unlocksLabel"),
      benefits: [t("benefitHigherLimits"), t("benefitFullFeatures")],
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col gap-8 p-6">
      <div className="flex justify-end">
        <Link href="/dashboard" aria-label={t("closeAria")} className="text-muted transition hover:text-foreground">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("stepsTitle")}</h1>
        <p className="text-sm text-muted">{t("stepsSubtitle")}</p>
      </div>

      <div className="flex flex-col">
        {STEPS.map((step, i) => (
          <div key={step.n} className="flex items-start gap-4">
            <div className="flex flex-col items-center self-stretch">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-semibold text-foreground">
                {step.n}
              </span>
              {i < STEPS.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className={`flex flex-col gap-2 ${i < STEPS.length - 1 ? "pb-8" : ""}`}>
              <p className="pt-1 text-sm font-semibold">{step.title}</p>
              {step.benefits && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted">{step.benefitsLabel}</p>
                  <ul className="flex flex-col gap-1.5">
                    {step.benefits.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-muted">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <Link
          href="/kyc"
          className="rounded-lg bg-brand px-4 py-3 text-center text-sm font-semibold text-brand-foreground transition hover:bg-brand-hover"
        >
          {t("startNow")}
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-border px-4 py-3 text-center text-sm text-muted transition hover:border-accent hover:text-accent"
        >
          {t("doItLater")}
        </Link>
      </div>
    </main>
  );
}
