"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { LEAD_TRADER_MARKETS } from "@/config/lead-trader";

export async function submitLeadTraderApplication(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/become-lead-trader"));

  const t = await getTranslations("Actions.leadTrader");

  if (!(await checkRateLimit("lead-trader-apply", 3, 3600))) {
    redirect("/become-lead-trader?error=" + encodeURIComponent(t("rateLimit")));
  }

  const { data: profile } = await supabase.from("profiles").select("is_lead_trader").eq("id", user.id).single();
  if (profile?.is_lead_trader) {
    redirect("/become-lead-trader?error=" + encodeURIComponent(t("alreadyLeader")));
  }

  const { count: activeCopies } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", user.id)
    .eq("is_active", true);
  if ((activeCopies ?? 0) > 0) {
    redirect("/become-lead-trader?error=" + encodeURIComponent(t("stillCopying")));
  }

  const { count: openPositions } = await supabase
    .from("simulated_positions")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", user.id)
    .eq("status", "open");
  if ((openPositions ?? 0) > 0) {
    redirect("/become-lead-trader?error=" + encodeURIComponent(t("openPositions")));
  }

  const displayName = ((formData.get("displayName") as string) ?? "").trim();
  const bio = ((formData.get("bio") as string) ?? "").trim();
  const tradingStyle = (formData.get("tradingStyle") as string) ?? "";
  const contactInfo = ((formData.get("contactInfo") as string) ?? "").trim();
  const minInvestmentRaw = Number(formData.get("minInvestment"));
  const agree = formData.get("agree") === "on";
  const markets = (LEAD_TRADER_MARKETS as readonly string[]).filter((m) => formData.get(`market_${m}`) === "on");

  if (!displayName || !bio || !agree || markets.length === 0) {
    redirect("/become-lead-trader?error=" + encodeURIComponent(t("missingFields")));
  }

  const { error } = await supabase.from("lead_trader_applications").insert({
    user_id: user.id,
    display_name: displayName,
    bio,
    markets,
    trading_style: tradingStyle || null,
    contact_info: contactInfo || null,
    requested_min_investment: Number.isFinite(minInvestmentRaw) && minInvestmentRaw > 0 ? minInvestmentRaw : null,
  });

  if (error) {
    // Unique index blocks a second pending application for the same user.
    const message = error.code === "23505" ? t("alreadyPending") : t("submitFailed");
    redirect("/become-lead-trader?error=" + encodeURIComponent(message));
  }

  revalidatePath("/become-lead-trader");
  redirect("/become-lead-trader?success=1");
}
