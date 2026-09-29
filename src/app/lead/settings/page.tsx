import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId, currentTier } from "@/lib/lead-trader";
import { computeActiveTradingDays } from "@/lib/reliability";
import { LEAD_TRADER_MARKETS, LEAD_TRADER_STYLES } from "@/config/lead-trader";
import { updateLeadTraderSettings, endLeadTraderRole } from "@/app/lead/settings/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function LeadSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const t = await getTranslations("LeadTrader.settings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead%2Fsettings");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: provider }, { data: ltProfile }, { data: application }, { data: subs }, { data: signals }] = await Promise.all([
    supabase.from("providers").select("display_name, bio, symbol_bias, min_copy_amount, profit_share_pct").eq("id", providerId).single(),
    supabase.from("lead_trader_profiles").select("min_investment, hide_country, trade_protection, accepting_followers").eq("provider_id", providerId).maybeSingle(),
    supabase.from("lead_trader_applications").select("contact_info, trading_style").eq("user_id", user.id).eq("status", "approved").order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("subscriptions").select("allocated_amount, is_active").eq("provider_id", providerId),
    supabase.from("signals").select("opened_at, status").eq("provider_id", providerId).eq("created_by_admin", false),
  ]);

  const aum = (subs ?? []).filter((s) => s.is_active).reduce((sum, s) => sum + Number(s.allocated_amount), 0);
  const activeDays = computeActiveTradingDays((signals ?? []).map((s) => ({ opened_at: s.opened_at })));
  const tier = currentTier({ activeDays, aum, followerProfit: 0, maxDrawdownPct: null });
  const hasOpenTrades = (signals ?? []).some((s) => s.status === "open");
  const markets = new Set(provider?.symbol_bias ?? []);
  const field = "rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">{t("title")}</h1>
      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {success && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{t("saved")}</p>}

      <form action={updateLeadTraderSettings} className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-section-title">{t("accountInfo")}</h2>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("displayNameLabel")}
          <input name="displayName" defaultValue={provider?.display_name ?? ""} required className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("bioLabel")}
          <textarea name="bio" rows={3} defaultValue={provider?.bio ?? ""} className={field} />
        </label>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">{t("marketsLabel")}</legend>
          <div className="flex flex-wrap gap-3">
            {LEAD_TRADER_MARKETS.map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="checkbox" name={`market_${m}`} defaultChecked={markets.has(m)} />
                {t(`market_${m}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("contactLabel")}
          <input name="contactInfo" defaultValue={application?.contact_info ?? ""} className={field} />
        </label>

        <h2 className="mt-2 text-section-title">{t("followerSettings")}</h2>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("minInvestmentLabel")}
          <input name="minInvestment" type="number" min={1} defaultValue={ltProfile?.min_investment ?? 100} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("minCopyAmountLabel")}
          <input name="minCopyAmount" type="number" min={1} defaultValue={provider?.min_copy_amount ?? 100} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("profitSharePctLabel", { max: tier.maxProfitSharePct })}
          <input name="profitSharePct" type="number" min={0} max={tier.maxProfitSharePct} step="any" defaultValue={provider?.profit_share_pct ?? 0} className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="acceptingFollowers" defaultChecked={ltProfile?.accepting_followers ?? true} />
          {t("acceptingFollowersLabel")}
        </label>
        <p className="-mt-3 text-xs text-muted">
          {t("whitelistNote")} <a href="/lead/followers" className="text-accent hover:underline">{t("whitelistLink")}</a>
        </p>

        <h2 className="mt-2 text-section-title">{t("privacy")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="hideCountry" defaultChecked={ltProfile?.hide_country ?? false} />
          {t("hideCountryLabel")}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("tradeProtectionLabel")}
          <select name="tradeProtection" defaultValue={ltProfile?.trade_protection ?? "none"} className={field}>
            <option value="none">{t("tradeProtectionNone")}</option>
            <option value="hidden">{t("tradeProtectionHidden")}</option>
            <option value="delayed">{t("tradeProtectionDelayed")}</option>
          </select>
        </label>

        <button type="submit" className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">
          {t("save")}
        </button>
      </form>

      <section className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-5">
        <h2 className="text-section-title text-danger">{t("endRoleTitle")}</h2>
        <p className="text-sm text-muted">{t("endRoleDesc")}</p>
        {hasOpenTrades && <p className="text-sm text-warning">{t("endRoleHasOpenTrades")}</p>}
        <form action={endLeadTraderRole}>
          <ConfirmButton
            confirmText={t("endRoleConfirm")}
            className="rounded-lg border border-danger/50 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10"
          >
            {t("endRoleButton")}
          </ConfirmButton>
        </form>
      </section>
      <p className="text-xs text-muted">
        {t("tradingStyleNote")}: {application?.trading_style ? t(`style_${application.trading_style}`) : t("styleAny")}
      </p>
    </div>
  );
}
