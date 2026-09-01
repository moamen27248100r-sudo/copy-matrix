"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  return { supabase, adminId: user.id };
}

async function logAdminAction(
  supabase: SupabaseClient,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details?: Record<string, unknown>,
) {
  await supabase.from("admin_audit_log").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ?? null,
  });
}

export async function approveKyc(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const submissionId = formData.get("submissionId") as string;

  await supabase
    .from("kyc_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  await logAdminAction(supabase, adminId, "approve_kyc", "kyc_submission", submissionId);

  revalidatePath("/admin");
  revalidatePath("/admin/kyc");
}

export async function rejectKyc(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const submissionId = formData.get("submissionId") as string;

  await supabase
    .from("kyc_submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  await logAdminAction(supabase, adminId, "reject_kyc", "kyc_submission", submissionId);

  revalidatePath("/admin");
  revalidatePath("/admin/kyc");
}

export async function approveWalletRequest(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const requestId = formData.get("requestId") as string;

  const { error } = await supabase
    .from("wallet_requests")
    .update({ status: "approved" })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    redirect("/admin/wallet-requests?error=" + encodeURIComponent("تعذّرت الموافقة على الطلب: " + error.message));
  }

  await logAdminAction(supabase, adminId, "approve_wallet_request", "wallet_request", requestId);

  revalidatePath("/admin");
  revalidatePath("/admin/wallet-requests");
}

export async function rejectWalletRequest(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const requestId = formData.get("requestId") as string;

  await supabase
    .from("wallet_requests")
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("status", "pending");

  await logAdminAction(supabase, adminId, "reject_wallet_request", "wallet_request", requestId);

  revalidatePath("/admin");
  revalidatePath("/admin/wallet-requests");
}

export async function toggleAdmin(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const targetId = formData.get("userId") as string;
  const nextValue = formData.get("nextValue") === "true";
  const returnTo = (formData.get("returnTo") as string) || "/admin/users";

  if (targetId === adminId) {
    redirect(`${returnTo}?error=` + encodeURIComponent("لا يمكنك تعديل صلاحيات حسابك الخاص."));
  }

  await supabase.from("profiles").update({ is_admin: nextValue }).eq("id", targetId);

  await logAdminAction(supabase, adminId, nextValue ? "grant_admin" : "revoke_admin", "profile", targetId);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetId}`);
}

export async function toggleSuspend(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const targetId = formData.get("userId") as string;
  const nextValue = formData.get("nextValue") === "true";
  const returnTo = (formData.get("returnTo") as string) || "/admin/users";

  if (targetId === adminId) {
    redirect(`${returnTo}?error=` + encodeURIComponent("لا يمكنك تعليق حسابك الخاص."));
  }

  await supabase.from("profiles").update({ is_suspended: nextValue }).eq("id", targetId);

  await logAdminAction(supabase, adminId, nextValue ? "suspend_user" : "unsuspend_user", "profile", targetId);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetId}`);
}

export async function adjustBalance(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const targetId = formData.get("userId") as string;
  const delta = Number(formData.get("delta"));
  const reason = ((formData.get("reason") as string) ?? "").trim();

  if (!Number.isFinite(delta) || delta === 0) {
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("قيمة التعديل غير صالحة."));
  }
  if (!reason) {
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("لازم تكتب سبب التعديل."));
  }

  const { data: target } = await supabase.from("profiles").select("balance").eq("id", targetId).single();
  if (!target) {
    redirect("/admin/users?error=" + encodeURIComponent("المستخدم غير موجود."));
  }

  const newBalance = Number(target.balance) + delta;
  const { error } = await supabase.from("profiles").update({ balance: newBalance }).eq("id", targetId);

  if (error) {
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("تعذّر تعديل الرصيد: " + error.message));
  }

  await supabase.from("wallet_transactions").insert({
    user_id: targetId,
    type: "admin_adjustment",
    amount: delta,
    balance_after: newBalance,
    note: reason,
  });

  await logAdminAction(supabase, adminId, "adjust_balance", "profile", targetId, { delta, reason, newBalance });

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${targetId}`);
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
  const { supabase, adminId } = await assertAdmin();
  const fields = readLeaderFields(formData);

  if (!fields.display_name) {
    redirect("/admin/traders?error=" + encodeURIComponent("اسم المتداول مطلوب."));
  }

  const { data, error } = await supabase.from("providers").insert(fields).select("id").single();

  if (error) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر إنشاء المتداول: " + error.message));
  }

  await logAdminAction(supabase, adminId, "create_leader", "provider", data?.id ?? null, {
    display_name: fields.display_name,
  });

  revalidatePath("/admin/traders");
  revalidatePath("/discover");
  revalidatePath("/");
}

export async function updateLeader(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const providerId = formData.get("providerId") as string;
  const fields = readLeaderFields(formData);

  if (!fields.display_name) {
    redirect("/admin/traders?error=" + encodeURIComponent("اسم المتداول مطلوب."));
  }

  const { error } = await supabase.from("providers").update(fields).eq("id", providerId);

  if (error) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر تحديث بيانات المتداول: " + error.message));
  }

  await logAdminAction(supabase, adminId, "update_leader", "provider", providerId, {
    display_name: fields.display_name,
  });

  revalidatePath("/admin/traders");
  revalidatePath("/discover");
  revalidatePath(`/trader/${providerId}`);
  revalidatePath("/");
}

export async function deleteLeader(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const providerId = formData.get("providerId") as string;

  const { error } = await supabase.from("providers").delete().eq("id", providerId);

  if (error) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر حذف المتداول: " + error.message));
  }

  await logAdminAction(supabase, adminId, "delete_leader", "provider", providerId);

  revalidatePath("/admin/traders");
  revalidatePath("/discover");
  revalidatePath("/");
}
