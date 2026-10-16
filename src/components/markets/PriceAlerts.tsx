import { getTranslations } from "next-intl/server";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/markets";
import { formatRelativeTime } from "@/lib/locale-format";
import { cancelPriceAlert, createPriceAlert } from "@/app/markets/actions";
import { PriceAlertForm } from "@/components/markets/PriceAlertForm";
import type { Locale } from "@/i18n/locales";

type AlertRow = { id: string; direction: "above" | "below"; target_price: number; created_price: number; status: string; triggered_at: string | null };

// Price alerts on an instrument (0266): set a target, see the active ones (remove any), and the
// last ones that were reached. The notice itself arrives in the notifications (category Market).
export async function PriceAlerts({
  userId,
  symbol,
  price,
  decimals,
  result,
  locale,
}: {
  userId: string;
  symbol: string;
  price: number;
  decimals: number;
  result?: string;
  locale: Locale;
}) {
  const t = await getTranslations("Markets");
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_alerts")
    .select("id, direction, target_price, created_price, status, triggered_at")
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .in("status", ["active", "triggered"])
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = (data ?? []) as AlertRow[];
  const active = rows.filter((r) => r.status === "active");
  const reached = rows.filter((r) => r.status === "triggered").slice(0, 3);
  const fmt = (v: number) => formatPrice(Number(v), decimals);
  const messages: Record<string, { tone: string; text: string }> = {
    created: { tone: "border-success/30 bg-success/10 text-success", text: t("alertCreated") },
    invalid: { tone: "border-danger/30 bg-danger/10 text-danger", text: t("alertErrInvalid") },
    same: { tone: "border-danger/30 bg-danger/10 text-danger", text: t("alertErrSame") },
    max: { tone: "border-danger/30 bg-danger/10 text-danger", text: t("alertErrMax") },
  };
  const msg = result ? messages[result] : undefined;

  return (
    <section id="alerts" className="flex scroll-mt-24 flex-col gap-4 rounded-[20px] border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-accent-text" aria-hidden="true" />
        <h2 className="text-section-title">{t("alertsTitle")}</h2>
      </div>
      <p className="text-sm text-muted">{t("alertsHint")}</p>
      {msg && (
        <p role="status" className={`rounded-xl border px-3 py-2 text-sm ${msg.tone}`}>
          {msg.text}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <PriceAlertForm action={createPriceAlert} symbol={symbol} price={price} decimals={decimals} labels={{ target: t("alertTargetLabel"), create: t("alertCreate") }} />
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold text-muted">{t("alertsActive")}</h3>
          {active.length === 0 ? (
            <p className="text-sm text-muted">{t("alertsEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {active.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm">
                    {t(a.direction === "above" ? "alertAbove" : "alertBelow", { price: "⁦" + fmt(a.target_price) + "⁩" })}
                  </span>
                  <form action={cancelPriceAlert}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="symbol" value={symbol} />
                    <button
                      type="submit"
                      aria-label={t("alertRemove")}
                      title={t("alertRemove")}
                      className="tap-44 flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-danger"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {reached.length > 0 && (
            <>
              <h3 className="mt-2 text-xs font-bold text-muted">{t("alertsRecent")}</h3>
              <ul className="flex flex-col gap-1">
                {reached.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm text-muted">
                    <span>{t(a.direction === "above" ? "alertAbove" : "alertBelow", { price: "⁦" + fmt(a.target_price) + "⁩" })}</span>
                    <span className="text-xs">{a.triggered_at ? formatRelativeTime(a.triggered_at, locale) : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
