"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";
import { checkPassword } from "@/lib/password-policy";
import { toE164 } from "@/lib/phone";

// Name and phone number, asked here and on the verification page (not at sign-up). The name is
// 2 to 60 characters; the phone is built into E.164 on the server and is unique to one account.
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tSettings = await getTranslations("Actions.settings");

  const displayName = String(formData.get("displayName") ?? "").trim().replace(/\s+/g, " ");

  if (displayName.length < 2 || displayName.length > 60) {
    redirect("/settings?error=" + encodeURIComponent(tSettings("nameEmpty")) + "&field=name");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    redirect("/settings?error=" + encodeURIComponent(tSettings("nameSaveFailed")) + "&field=name");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?success=1");
}

export async function updatePhone(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const tSettings = await getTranslations("Actions.settings");
  const back = formData.get("returnTo") === "/kyc" ? "/kyc" : "/settings";

  const phone = toE164(String(formData.get("phoneCountryCode") ?? ""), String(formData.get("phoneCountryIso") ?? ""), String(formData.get("phoneNumber") ?? ""));
  if (!phone) redirect(back + "?error=" + encodeURIComponent(tSettings("phoneInvalid")) + "&field=phone");

  const { error } = await supabase.rpc("set_my_phone", { p_phone: phone });
  if (error) {
    redirect(back + "?error=" + encodeURIComponent(tSettings(error.code === "CM073" ? "phoneTaken" : "phoneInvalid")) + "&field=phone");
  }
  revalidatePath("/settings");
  revalidatePath("/kyc");
  redirect(back + (back === "/kyc" ? "?phone=saved" : "?success=1"));
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const back = formData.get("returnTo") === "/account/security" ? "/account/security" : "/settings";
  const tAuth = await getTranslations("Auth");
  const issue = await checkPassword(password, user.email);
  if (issue) {
    const key = { short: "passwordMin8Error", common: "passwordCommonError", email: "passwordEmailError", breached: "passwordBreachedError" }[issue];
    redirect(back + "?error=" + encodeURIComponent(tAuth(key)));
  }
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    const ta = await getTranslations("Actions.auth");
    redirect(back + "?error=" + encodeURIComponent(translateAuthError(error.message, ta)));
  }

  redirect(back + "?success=1");
}

// Risk questionnaire: three 1-3 answers -> a profile stored in a cookie that
// the dashboard's "suggested traders" reads (low / medium / high risk).
export async function saveRiskProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const score = ["q1", "q2", "q3"].reduce((sum, k) => {
    const v = Number(formData.get(k));
    return sum + (v >= 1 && v <= 3 ? v : 2);
  }, 0);
  const profile = score <= 4 ? "low" : score <= 7 ? "medium" : "high";
  (await cookies()).set("risk_profile", profile, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  revalidatePath("/dashboard");
  redirect("/settings?success=1");
}

// Loss alerts: one threshold (in %) per active copy and one for the whole portfolio. An empty field
// removes the alert. The database (set_loss_alert) validates the range and the ownership.
export async function saveLossAlerts(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ta = await getTranslations("Settings");
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const jobs: { providerId: string | null; threshold: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    let providerId: string | null;
    if (key === "portfolio") providerId = null;
    else if (key.startsWith("copy_") && UUID.test(key.slice(5))) providerId = key.slice(5);
    else continue;
    const text = raw.trim().replace(",", ".");
    const threshold = text === "" ? 0 : Number(text);
    if (!Number.isFinite(threshold) || threshold < 0 || (threshold > 0 && (threshold < 1 || threshold > 90))) {
      redirect("/settings?error=" + encodeURIComponent(ta("lossAlertsInvalid")));
    }
    jobs.push({ providerId, threshold });
  }

  for (const job of jobs) {
    const { error } = await supabase.rpc("set_loss_alert", { p_provider_id: job.providerId, p_threshold: job.threshold });
    if (error) redirect("/settings?error=" + encodeURIComponent(ta("lossAlertsFailed")));
  }

  revalidatePath("/settings");
  redirect("/settings?success=1");
}
