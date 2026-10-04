import { getMoney } from "@/lib/money-server";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TraderAvatar } from "@/components/TraderAvatar";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { stopCopyingNow, updateCopyRiskSettings } from "@/app/discover/actions";

type CopiedProvider = {
  providerId: string;
  displayName: string;
  avatarUrl: string | null;
  ratingScore: number | null;
  allocatedAmount: number;
  maxDrawdownPct: number;
  cumulativePnl: number;
  takeProfitPct?: number | null;
  stopLossPct?: number | null;
  trailingPct?: number | null;
};

// Cumulative closed pnl for this subscription vs. -(allocated * maxDrawdownPct / 100)
// is the exact same threshold check auto_stop_copy uses server-side (0168) --
// this bar just shows the customer how much of that budget is left, live.
export async function ActiveCopyControlPanel({
  provider,
  returnTo = "/dashboard",
  editable = false,
}: {
  provider: CopiedProvider;
  returnTo?: string;
  // Shows the per-trade take-profit / stop-loss / trailing editor.
  editable?: boolean;
}) {
  const t = await getTranslations("Dashboard");
  const tr = await getTranslations("CopyRisk");
  const off = tr("off");
  const pct = (v: number | null | undefined) => (v == null ? off : `${v}%`);
  const money = await getMoney();
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
              {t("startedWith", { amount: money(provider.allocatedAmount) })}
            </p>
          </div>
        </Link>
        <form action={stopCopyingNow}>
          <input type="hidden" name="providerId" value={provider.providerId} />
          <input type="hidden" name="returnTo" value={returnTo} />
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
      {editable && (
        <details className="group border-t border-slate-800 pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs">
            <span className="font-medium">{tr("title")}</span>
            <span className="text-muted" dir="ltr">
              {tr("tpShort")} {pct(provider.takeProfitPct)} · {tr("slShort")} {pct(provider.stopLossPct)} · {tr("trailingShort")} {pct(provider.trailingPct)}
            </span>
          </summary>
          <form action={updateCopyRiskSettings} className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="providerId" value={provider.providerId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                {tr("tp")}
                <input name="takeProfitPct" type="number" step="any" min={1} max={500} defaultValue={provider.takeProfitPct ?? ""} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground" dir="ltr" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {tr("sl")}
                <input name="tradeStopLossPct" type="number" step="any" min={1} max={90} defaultValue={provider.stopLossPct ?? ""} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground" dir="ltr" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {tr("trailing")}
                <input name="trailingPct" type="number" step="any" min={0.5} max={50} defaultValue={provider.trailingPct ?? ""} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground" dir="ltr" />
              </label>
            </div>
            <p className="text-xs text-muted">{tr("hint")}</p>
            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" name="applyToOpen" className="mt-0.5" />
              <span>{tr("applyToOpen")}</span>
            </label>
            <SubmitButton className="self-start rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground transition hover:bg-accent-hover">
              {tr("save")}
            </SubmitButton>
          </form>
        </details>
      )}
    </div>
  );
}
