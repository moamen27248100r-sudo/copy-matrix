import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TraderAvatar } from "@/components/TraderAvatar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { unfollowProvider } from "@/app/discover/actions";

type CopiedProvider = {
  providerId: string;
  displayName: string;
  avatarUrl: string | null;
  ratingScore: number | null;
  allocatedAmount: number;
  maxDrawdownPct: number;
  cumulativePnl: number;
};

// Cumulative closed pnl for this subscription vs. -(allocated * maxDrawdownPct / 100)
// is the exact same threshold check auto_stop_copy uses server-side (0168) --
// this bar just shows the customer how much of that budget is left, live.
export async function ActiveCopyControlPanel({ provider }: { provider: CopiedProvider }) {
  const t = await getTranslations("Dashboard");
  const lossBudget = provider.allocatedAmount * (provider.maxDrawdownPct / 100);
  const lossUsed = Math.max(0, -provider.cumulativePnl);
  const usedPct = lossBudget > 0 ? Math.min(100, (lossUsed / lossBudget) * 100) : 0;
  const barColor = usedPct >= 80 ? "bg-danger" : usedPct >= 50 ? "bg-warning" : "bg-success";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/trader/${provider.providerId}`} className="flex min-w-0 items-center gap-3">
          <TraderAvatar
            providerId={provider.providerId}
            name={provider.displayName}
            avatarUrl={provider.avatarUrl}
            ratingScore={provider.ratingScore}
            size={44}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{provider.displayName}</p>
            <p className="text-xs text-muted">
              {t("startedWith", { amount: provider.allocatedAmount.toLocaleString("en-US") })}
            </p>
          </div>
        </Link>
        <form action={unfollowProvider}>
          <input type="hidden" name="providerId" value={provider.providerId} />
          <input type="hidden" name="returnTo" value="/dashboard" />
          <ConfirmButton
            confirmText={t("stopCopyingConfirm")}
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-danger/50 hover:text-danger"
          >
            {t("stopCopying")}
          </ConfirmButton>
        </form>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{t("riskProtectionLabel")}</span>
          <span className={usedPct >= 80 ? "text-danger" : usedPct >= 50 ? "text-warning" : "text-success"} dir="ltr">
            {t("riskProtectionUsed", { pct: usedPct.toFixed(0), maxPct: provider.maxDrawdownPct })}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${usedPct}%` }} />
        </div>
      </div>
    </div>
  );
}
