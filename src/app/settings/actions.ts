"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // High enough to clear the min_copy_amount of nearly every leader on the
  // platform, so a demo account isn't blocked from copying almost anyone.
  const balance = accountType === "real" ? 0 : 10000;

  // account_type/balance have no direct-client UPDATE grant (balance in
  // particular must never be client-settable to an arbitrary value) --
  // this hardcoded 0-or-10000 assignment is the only legitimate way to
  // change it, so it goes through the service-role client.
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ account_type: accountType, balance })
    .eq("id", user.id);

  if (error) {
    const tSettings = await getTranslations("Actions.settings");
    redirect("/settings?error=" + encodeURIComponent(tSettings("accountTypeUpdateFailed")));
  }

  // Same reset-on-switch rule as chooseAccountType: a copy relationship
  // funded from the old balance shouldn't survive into the fresh account.
  await supabase.from("subscriptions").update({ is_active: false }).eq("follower_id", user.id).eq("is_active", true);

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
