"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId, currentTier } from "@/lib/lead-trader";
import { computeActiveTradingDays } from "@/lib/reliability";
import { LEAD_TRADER_MARKETS } from "@/config/lead-trader";

export async function updateLeadTraderSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Actions.leadTrader");
  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  // Recompute the tier server-side (never trust a max-share-pct from the form)
  // the same way the overview page does.
  const [{ data: subs }, { data: signals }] = await Promise.all([
    supabase.from("subscriptions").select("allocated_amount, is_active").eq("provider_id", providerId),
    supabase.from("signals").select("opened_at, closed_at").eq("provider_id", providerId).eq("created_by_admin", false).eq("hidden", false),
  ]);
  const aum = (subs ?? []).filter((s) => s.is_active).reduce((sum, s) => sum + Number(s.allocated_amount), 0);
  const activeDays = computeActiveTradingDays(signals ?? []);
  const tier = currentTier({ activeDays, aum, followerProfit: 0, maxDrawdownPct: null });

  const markets = (LEAD_TRADER_MARKETS as readonly string[]).filter((m) => formData.get(`market_${m}`) === "on");

  const { error } = await supabase.rpc("lead_trader_update_profile", {
    p_display_name: ((formData.get("displayName") as string) ?? "").trim(),
    p_bio: ((formData.get("bio") as string) ?? "").trim() || null,
    p_markets: markets,
    p_contact_info: null,
    p_min_copy_amount: Number(formData.get("minCopyAmount")),
    p_profit_share_pct: Number(formData.get("profitSharePct")),
    p_max_profit_share_pct: tier.maxProfitSharePct,
    p_min_investment: Number(formData.get("minInvestment")),
    p_hide_country: formData.get("hideCountry") === "on",
    p_trade_protection: (formData.get("tradeProtection") as string) ?? "none",
    p_accepting_followers: formData.get("acceptingFollowers") === "on",
  });

  const contactInfo = ((formData.get("contactInfo") as string) ?? "").trim();
  await supabase.rpc("lead_trader_update_contact_info", { p_contact_info: contactInfo || null });

  if (error) {
    redirect("/lead/settings?error=" + encodeURIComponent(t("settingsSaveFailed")));
  }

  revalidatePath("/lead/settings");
  revalidatePath("/lead");
  redirect("/lead/settings?success=1");
}

export async function endLeadTraderRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Actions.leadTrader");
  const { error } = await supabase.rpc("lead_trader_end_role");
  if (error) {
    const message = error.code === "LT013" ? t("endRoleHasOpenTrades") : t("endRoleFailed");
    redirect("/lead/settings?error=" + encodeURIComponent(message));
  }

  revalidatePath("/lead");
  redirect("/dashboard");
}
