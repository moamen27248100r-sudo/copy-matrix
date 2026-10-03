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
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    const ta = await getTranslations("Actions.auth");
    redirect("/settings?error=" + encodeURIComponent(translateAuthError(error.message, ta)));
  }

  redirect("/settings?success=1");
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
