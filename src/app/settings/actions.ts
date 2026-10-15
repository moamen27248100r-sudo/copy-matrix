"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tSettings = await getTranslations("Actions.settings");

  const displayName = (formData.get("displayName") as string).trim();

  if (!displayName) {
    redirect("/settings?error=" + encodeURIComponent(tSettings("nameEmpty")));
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    redirect("/settings?error=" + encodeURIComponent(tSettings("nameSaveFailed")));
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?success=1");
}

export async function updateAccountType(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const accountType = formData.get("accountType") === "real" ? "real" : "demo";

  // Swaps the active wallet (demo <-> real) server-side; the two balances are
  // stored separately and never converted into each other.
  const { error } = await supabase.rpc("switch_account_type", { p_type: accountType });

  if (error) {
    const tSettings = await getTranslations("Actions.settings");
    redirect(
      "/settings?error=" +
        encodeURIComponent(error.code === "CM010" ? tSettings("accountSwitchOpenPositions") : tSettings("accountTypeUpdateFailed")),
    );
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?success=1");
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const password = formData.get("password") as string;
  const back = formData.get("returnTo") === "/account/security" ? "/account/security" : "/settings";
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
