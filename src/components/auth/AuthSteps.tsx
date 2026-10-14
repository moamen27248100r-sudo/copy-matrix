import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

// "Step 2 of 3" with a progress bar, and (when there is a previous step) a Back link inside the
// page, so a customer never has to rely on the browser's back button.
export async function AuthSteps({ step, total = 3, backHref }: { step: number; total?: number; backHref?: string }) {
  const t = await getTranslations("Auth");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>{t("stepOf", { step, total })}</span>
        {backHref && (
          <Link href={backHref} className="tap-44 inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" aria-hidden="true" />
            {t("stepBack")}
          </Link>
        )}
      </div>
      <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}
