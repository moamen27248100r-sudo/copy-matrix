"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const displayName = (formData.get("displayName") as string).trim();

  if (!displayName) {
    redirect("/settings?error=" + encodeURIComponent("الاسم لا يمكن أن يكون فارغًا."));
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    redirect("/settings?error=" + encodeURIComponent("تعذّر حفظ الاسم. حاول مرة أخرى."));
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

  const { error } = await supabase
    .from("profiles")
    .update({ account_type: accountType })
    .eq("id", user.id);

  if (error) {
    redirect("/settings?error=" + encodeURIComponent("تعذّر تحديث نوع الحساب. حاول مرة أخرى."));
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
    redirect("/settings?error=" + encodeURIComponent(translateAuthError(error.message)));
  }

  redirect("/settings?success=1");
}
