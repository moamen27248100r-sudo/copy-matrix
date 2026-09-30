"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnProviderId } from "@/lib/lead-trader";

const AVATAR_BUCKET = "leader-avatars";
const AVATAR_MAX_BYTES = 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function requireLeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");
  return { supabase, providerId };
}

// Keeps every field the settings page owns at its current value and changes
// only what the public-profile form edits, so the two forms can't clobber
// each other. The profit-share ceiling passed is the current rate itself, so
// this path can never raise it (the tier-checked path is settings).
export async function saveLeadPublicProfile(formData: FormData) {
  const { supabase, providerId } = await requireLeader();

  const [{ data: provider }, { data: lt }] = await Promise.all([
    supabase.from("providers").select("display_name, symbol_bias, min_copy_amount, profit_share_pct").eq("id", providerId).single(),
    supabase.from("lead_trader_profiles").select("min_investment, hide_country, trade_protection, accepting_followers").eq("provider_id", providerId).maybeSingle(),
  ]);
  if (!provider) redirect("/lead/profile?err=saveFailed");

  const { error } = await supabase.rpc("lead_trader_update_profile", {
    p_display_name: provider.display_name,
    p_bio: ((formData.get("bio") as string) ?? "").trim().slice(0, 600) || null,
    p_markets: provider.symbol_bias ?? [],
    p_contact_info: null,
    p_min_copy_amount: provider.min_copy_amount,
    p_profit_share_pct: provider.profit_share_pct,
    p_max_profit_share_pct: provider.profit_share_pct ?? 0,
    p_min_investment: lt?.min_investment ?? 100,
    p_hide_country: lt?.hide_country ?? false,
    p_trade_protection: lt?.trade_protection ?? "none",
    p_accepting_followers: formData.get("acceptingFollowers") === "on",
  });
  const { error: error2 } = await supabase.rpc("lead_trader_update_public_profile", {
    p_strategy: (formData.get("strategy") as string) ?? "",
    p_risk: (formData.get("risk") as string) ?? "",
  });
  if (error || error2) redirect("/lead/profile?err=" + (error2?.code === "LT030" ? "tooLong" : "saveFailed"));

  revalidatePath("/lead/profile");
  revalidatePath("/lead");
  revalidatePath(`/trader/${providerId}`);
  redirect("/lead/profile?ok=1");
}

export async function uploadLeadAvatar(formData: FormData) {
  const { supabase, providerId } = await requireLeader();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) redirect("/lead/profile?err=avatarMissing");
  const ext = AVATAR_TYPES[file.type];
  if (!ext) redirect("/lead/profile?err=avatarType");
  if (file.size > AVATAR_MAX_BYTES) redirect("/lead/profile?err=avatarSize");

  const { data: current } = await supabase.from("providers").select("avatar_url").eq("id", providerId).single();

  // The bucket has no client write policy: the file goes up with the service
  // role, but only after requireLeader() proved ownership of providerId, and
  // the path is always inside that provider's own folder.
  const admin = createAdminClient();
  const path = `${providerId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (uploadError) redirect("/lead/profile?err=saveFailed");

  const publicUrl = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.rpc("lead_trader_set_avatar", { p_url: publicUrl });
  if (error) {
    await admin.storage.from(AVATAR_BUCKET).remove([path]);
    redirect("/lead/profile?err=saveFailed");
  }

  const marker = `/${AVATAR_BUCKET}/`;
  const old = current?.avatar_url ?? null;
  const i = old ? old.indexOf(marker) : -1;
  if (old && i >= 0) await admin.storage.from(AVATAR_BUCKET).remove([old.slice(i + marker.length)]);

  revalidatePath("/lead/profile");
  revalidatePath(`/trader/${providerId}`);
  redirect("/lead/profile?ok=1");
}
