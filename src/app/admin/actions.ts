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
