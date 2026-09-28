import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Shown instead of the empty "no copy yet" box for a brand-new customer
// (dashboard/page.tsx only renders this while copiedProviders.length === 0).
// Copying a first trader is itself one of the four steps, so the card's
// job is naturally done once the customer does that -- the section then
// switches to the real active-copies view instead of a stale "3/4" card.
export async function OnboardingStepsCard({
  profileComplete,
  protectionReady,
}: {
  profileComplete: boolean;
  protectionReady: boolean;
}) {
  const t = await getTranslations("Dashboard");

  const steps = [
    { done: profileComplete, href: "/settings", label: t("stepProfile") },
    { done: false, href: "/discover", label: t("stepFirstCopy") },
    { done: protectionReady, href: "/kyc", label: t("stepProtection") },
    { done: false, href: "/notifications", label: t("stepNotifications") },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const progressPct = (doneCount / steps.length) * 100;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("onboardingCardTitle")}</h2>
        <span className="text-xs text-muted" dir="ltr">
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex flex-col gap-1">
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5"
          >
            <span
              className={
                step.done
                  ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-background"
                  : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border"
              }
            >
              {step.done && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className={step.done ? "text-sm text-muted line-through" : "text-sm text-foreground"}>
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
