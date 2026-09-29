"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";

export async function removeFollower(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Actions.leadTrader");
  const subscriptionId = formData.get("subscriptionId") as string;
  const reason = ((formData.get("reason") as string) ?? "").trim();

  const { error } = await supabase.rpc("lead_trader_remove_follower", { p_subscription_id: subscriptionId, p_reason: reason || null });
  if (error) {
    const map: Record<string, string> = {
      LT007: t("removeLimitReached"),
      LT008: t("removeHasOpenPositions"),
    };
    redirect("/lead/followers?error=" + encodeURIComponent(map[error.code] ?? t("removeFailed")));
  }

  revalidatePath("/lead/followers");
  revalidatePath("/lead");
}

export async function createFollowerInvite(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Actions.leadTrader");
  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const email = ((formData.get("email") as string) ?? "").trim() || null;
  const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  const { error } = await supabase.from("follower_invites").insert({ provider_id: providerId, code, invited_email: email });
  if (error) {
    redirect("/lead/followers?error=" + encodeURIComponent(t("inviteFailed")));
  }

  revalidatePath("/lead/followers");
}

export async function postAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Actions.leadTrader");
  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const body = ((formData.get("body") as string) ?? "").trim();
  if (!body) {
    redirect("/lead/followers?error=" + encodeURIComponent(t("announcementEmpty")));
  }

  // Inserts the announcement and notifies every active follower atomically
  // (see migration 0202) -- a plain client insert can't reach `notifications`
  // for other users, only an admin or a SECURITY DEFINER RPC can.
  const { error } = await supabase.rpc("lead_trader_post_announcement", { p_body: body });
  if (error) {
    redirect("/lead/followers?error=" + encodeURIComponent(t("announcementFailed")));
  }

  revalidatePath("/lead/followers");
}
