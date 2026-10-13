import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { saveLossAlerts } from "@/app/settings/actions";
import { SubmitButton } from "@/components/SubmitButton";

// Loss alerts: the customer picks a loss (in %) that should notify them, for the whole portfolio
// and for each trader they copy right now. The alert is sent once when the loss reaches the value
// and again only after it has fallen back under it (evaluate_loss_alerts, migration 0255).
export async function LossAlertsSection({ userId }: { userId: string }) {
  const t = await getTranslations("Settings");
  const supabase = await createClient();

  const [{ data: rules }, { data: subs }] = await Promise.all([
    supabase.from("loss_alert_rules").select("provider_id, threshold_pct").eq("user_id", userId),
    supabase.from("subscriptions").select("provider_id, allocated_amount").eq("follower_id", userId).eq("is_active", true),
  ]);
  const ids = (subs ?? []).map((s) => s.provider_id);
  const { data: cards } =
    ids.length > 0 ? await supabase.from("provider_cards").select("provider_id, display_name").in("provider_id", ids) : { data: [] as { provider_id: string; display_name: string }[] };
  const nameById = new Map((cards ?? []).map((c) => [c.provider_id, c.display_name]));
  const thresholdFor = (providerId: string | null) => {
    const r = (rules ?? []).find((x) => (x.provider_id ?? null) === providerId);
    return r ? String(Number(r.threshold_pct)) : "";
  };

  const inputClass = "min-h-11 w-24 rounded border border-border bg-background px-3 py-2 text-base text-end";

  return (
    <section id="loss-alerts" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-medium">{t("lossAlertsTitle")}</h2>
      <p className="text-xs text-muted">{t("lossAlertsDesc")}</p>
      <form action={saveLossAlerts} className="flex flex-col gap-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0">{t("lossAlertsPortfolio")}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <input name="portfolio" type="number" inputMode="decimal" min={1} max={90} step="any" defaultValue={thresholdFor(null)} placeholder="10" className={inputClass} dir="ltr" />
            <span className="text-muted">%</span>
          </span>
        </label>

        {(subs ?? []).length === 0 ? (
          <p className="text-xs text-muted">{t("lossAlertsNoCopies")}</p>
        ) : (
          (subs ?? []).map((s) => (
            <label key={s.provider_id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{t("lossAlertsCopyOf", { name: nameById.get(s.provider_id) ?? "—" })}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <input
                  name={`copy_${s.provider_id}`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={90}
                  step="any"
                  defaultValue={thresholdFor(s.provider_id)}
                  placeholder="10"
                  className={inputClass}
                  dir="ltr"
                />
                <span className="text-muted">%</span>
              </span>
            </label>
          ))
        )}

        <p className="text-xs text-muted">{t("lossAlertsHint")}</p>
        <SubmitButton className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {t("lossAlertsSave")}
        </SubmitButton>
      </form>
    </section>
  );
}
