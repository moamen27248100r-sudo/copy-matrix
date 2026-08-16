"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/admin/login");

  return supabase;
}

export async function approveKyc(formData: FormData) {
  const supabase = await assertAdmin();
  const submissionId = formData.get("submissionId") as string;

  await supabase
    .from("kyc_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  revalidatePath("/admin");
}

export async function rejectKyc(formData: FormData) {
  const supabase = await assertAdmin();
  const submissionId = formData.get("submissionId") as string;

  await supabase
    .from("kyc_submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  revalidatePath("/admin");
}

export async function approveWalletRequest(formData: FormData) {
  const supabase = await assertAdmin();
  const requestId = formData.get("requestId") as string;

  const { error } = await supabase
    .from("wallet_requests")
    .update({ status: "approved" })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    redirect("/admin?error=" + encodeURIComponent("تعذّرت الموافقة على الطلب: " + error.message));
  }

  revalidatePath("/admin");
}

export async function rejectWalletRequest(formData: FormData) {
  const supabase = await assertAdmin();
  const requestId = formData.get("requestId") as string;

  await supabase
    .from("wallet_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("status", "pending");

  revalidatePath("/admin");
}

export async function toggleAdmin(formData: FormData) {
  const supabase = await assertAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const targetId = formData.get("userId") as string;
  const nextValue = formData.get("nextValue") === "true";

  if (targetId === user?.id) {
    redirect("/admin?error=" + encodeURIComponent("لا يمكنك تعديل صلاحيات حسابك الخاص."));
  }

  await supabase.from("profiles").update({ is_admin: nextValue }).eq("id", targetId);

  revalidatePath("/admin");
}

export async function toggleSuspend(formData: FormData) {
  const supabase = await assertAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const targetId = formData.get("userId") as string;
  const nextValue = formData.get("nextValue") === "true";

  if (targetId === user?.id) {
    redirect("/admin?error=" + encodeURIComponent("لا يمكنك تعليق حسابك الخاص."));
  }

  await supabase.from("profiles").update({ is_suspended: nextValue }).eq("id", targetId);

  revalidatePath("/admin");
}

function readLeaderFields(formData: FormData) {
  const displayName = ((formData.get("displayName") as string) ?? "").trim();
  const bio = ((formData.get("bio") as string) ?? "").trim();
  const skillPct = Number(formData.get("skill"));
  const minCopyAmount = Number(formData.get("minCopyAmount"));
  const baseFollowers = Number(formData.get("baseFollowers"));

  return {
    display_name: displayName,
    bio: bio || null,
    skill: Math.min(0.85, Math.max(0.3, (Number.isFinite(skillPct) ? skillPct : 55) / 100)),
    min_copy_amount: Number.isFinite(minCopyAmount) && minCopyAmount > 0 ? minCopyAmount : 50,
    base_followers_count: Number.isFinite(baseFollowers) && baseFollowers >= 0 ? baseFollowers : 0,
  };
}

export async function createLeader(formData: FormData) {
  const supabase = await assertAdmin();
  const fields = readLeaderFields(formData);

  if (!fields.display_name) {
    redirect("/admin?error=" + encodeURIComponent("اسم المتداول مطلوب."));
  }

  const { error } = await supabase.from("providers").insert(fields);

  if (error) {
    redirect("/admin?error=" + encodeURIComponent("تعذّر إنشاء المتداول: " + error.message));
  }

  revalidatePath("/admin");
  revalidatePath("/discover");
  revalidatePath("/");
}

export async function updateLeader(formData: FormData) {
  const supabase = await assertAdmin();
  const providerId = formData.get("providerId") as string;
  const fields = readLeaderFields(formData);

  if (!fields.display_name) {
    redirect("/admin?error=" + encodeURIComponent("اسم المتداول مطلوب."));
  }

  const { error } = await supabase.from("providers").update(fields).eq("id", providerId);

  if (error) {
    redirect("/admin?error=" + encodeURIComponent("تعذّر تحديث بيانات المتداول: " + error.message));
  }

  revalidatePath("/admin");
  revalidatePath("/discover");
  revalidatePath(`/trader/${providerId}`);
  revalidatePath("/");
}

export async function deleteLeader(formData: FormData) {
  const supabase = await assertAdmin();
  const providerId = formData.get("providerId") as string;

  const { error } = await supabase.from("providers").delete().eq("id", providerId);

  if (error) {
    redirect("/admin?error=" + encodeURIComponent("تعذّر حذف المتداول: " + error.message));
  }

  revalidatePath("/admin");
  revalidatePath("/discover");
  revalidatePath("/");
}
