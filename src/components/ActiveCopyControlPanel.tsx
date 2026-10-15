import { getMoney } from "@/lib/money-server";
import { ltrIsolate } from "@/lib/format-stats";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TraderAvatar } from "@/components/TraderAvatar";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { stopCopyingNow, updateCopyRiskSettings } from "@/app/discover/actions";
import { getLocale } from "next-intl/server";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

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
  /** Live result of the copy's open trades, how many are open, and when copying started (copies page). */
  unrealized?: number;
  openCount?: number;
  startedAt?: string | null;
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
  const tc = await getTranslations("Copies");
  const tcd = await getTranslations("CopyDialog");
  const tp = await getTranslations("TraderProfile");
  const locale = (await getLocale()) as Locale;
  const hasLive = provider.unrealized !== undefined;
  const unrealized = provider.unrealized ?? 0;
  const openCount = provider.openCount ?? 0;
  const currentValue = provider.allocatedAmount + provider.cumulativePnl + unrealized;
  const tone = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-danger" : "");
  const off = tr("off");
  const pct = (v: number | null | undefined) => (v == null ? off : `${v}%`);
  const money = await getMoney();
  const lossBudget = provider.allocatedAmount * (provider.maxDrawdownPct / 100);
  const lossUsed = Math.max(0, -provider.cumulativePnl);
  const usedPct = lossBudget > 0 ? Math.min(100, (lossUsed / lossBudget) * 100) : 0;
  const barColor = usedPct >= 80 ? "bg-danger" : usedPct >= 50 ? "bg-warning" : "bg-success";

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-slate-800 bg-surface p-5">
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
            <p className="truncate text-base font-bold">{provider.displayName}</p>
            {hasLive && provider.startedAt && <p className="text-xs text-muted">{tc("since", { date: formatDate(provider.startedAt, locale) })}</p>}
            {!hasLive && (
              <p className="text-xs text-muted">
                {t("startedWith", { amount: money(provider.allocatedAmount) })}
              </p>
            )}
            <p className={hasLive ? "hidden" : "text-xs text-muted"}>
              {t("copyRealizedPnl")}{" "}
              <span dir="ltr" className={`inline-block font-medium ${provider.cumulativePnl > 0 ? "text-success" : provider.cumulativePnl < 0 ? "text-danger" : "text-foreground"}`}>
                {money(provider.cumulativePnl, { signed: true })}
              </span>
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

      {hasLive && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: tc("allocated"), value: money(provider.allocatedAmount), cls: "" },
              { label: tc("currentValue"), value: money(currentValue), cls: "" },
              { label: tc("unrealized"), value: money(unrealized, { signed: unrealized !== 0 }), cls: tone(unrealized) },
              { label: tc("realized"), value: money(provider.cumulativePnl, { signed: provider.cumulativePnl !== 0 }), cls: tone(provider.cumulativePnl) },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-background/60 px-3 py-2.5">
                <dd className={`text-base font-bold ${x.cls}`}>
                  <bdi dir="ltr">{x.value}</bdi>
                </dd>
                <dt className="text-xs text-muted">{x.label}</dt>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
            <Link href="/trades" className="font-medium text-accent-text hover:underline">
              {t("openTradesCount", { count: openCount })}
            </Link>
            <Link href={`/trader/${provider.providerId}#copy`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-accent/50">
              {tp("manageCopy")}
            </Link>
          </div>
          {openCount > 0 && <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">{tcd("lockedNotice")}</p>}
        </>
      )}

      <div className="flex flex-col gap-1.5 border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{t("riskProtectionLabel")}</span>
          <span className={usedPct >= 80 ? "text-danger" : usedPct >= 50 ? "text-warning" : "text-success"}>
            {t("riskProtectionUsed", { pct: ltrIsolate(usedPct.toFixed(0)), maxPct: ltrIsolate(String(provider.maxDrawdownPct)) })}
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
            <span className="text-muted">
              {provider.takeProfitPct == null && provider.stopLossPct == null && provider.trailingPct == null
                ? tr("allOff")
                : [
                    `${tr("tpShort")} ${pct(provider.takeProfitPct)}`,
                    `${tr("slShort")} ${pct(provider.stopLossPct)}`,
                    `${tr("trailingShort")} ${pct(provider.trailingPct)}`,
                  ].join(" · ")}
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
