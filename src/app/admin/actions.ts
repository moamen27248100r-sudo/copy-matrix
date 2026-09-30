"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { defaultAvatarUrl } from "@/lib/avatar-url";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLotSize } from "@/lib/pip-specs";

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
  // For deposits specifically, the admin can confirm the amount that was
  // actually received (e.g. the client requested $1000 but only sent
  // $200) — the trigger that credits the balance uses whatever value is
  // in this column at approval time, not what the client originally
  // typed, so this must be corrected here before approving.
  const actualAmountRaw = formData.get("actualAmount");
  const actualAmount =
    actualAmountRaw != null && actualAmountRaw !== "" ? Number(actualAmountRaw) : null;

  if (actualAmount != null && (!Number.isFinite(actualAmount) || actualAmount <= 0)) {
    redirect("/admin/wallet-requests?error=" + encodeURIComponent("المبلغ الفعلي المؤكَّد غير صالح."));
  }

  const updatePayload: { status: "approved"; amount?: number } = { status: "approved" };
  if (actualAmount != null) updatePayload.amount = actualAmount;

  const { error } = await supabase
    .from("wallet_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) {
    redirect("/admin/wallet-requests?error=" + encodeURIComponent("تعذّرت الموافقة على الطلب: " + error.message));
  }

  await logAdminAction(
    supabase,
    adminId,
    "approve_wallet_request",
    "wallet_request",
    requestId,
    actualAmount != null ? { confirmedAmount: actualAmount } : undefined,
  );

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

  // is_admin has no direct-client UPDATE grant (a customer could otherwise
  // self-escalate) -- only the service-role client can write it.
  await createAdminClient().from("profiles").update({ is_admin: nextValue }).eq("id", targetId);

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

  // Same as is_admin above -- no direct-client UPDATE grant on is_suspended.
  await createAdminClient().from("profiles").update({ is_suspended: nextValue }).eq("id", targetId);

  await logAdminAction(supabase, adminId, nextValue ? "suspend_user" : "unsuspend_user", "profile", targetId);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${targetId}`);
}

// Lets an admin act on the platform exactly as a given customer (start a
// copy, deposit/withdraw, etc.) for support/troubleshooting — not just view
// their data. Swaps the *current* browser session over to the target user
// via a Supabase-generated sign-in link (needs the service-role client;
// there's no other way to mint a session for someone else without their
// password). The admin's own session is stashed in an httpOnly cookie
// first so "العودة لحساب الأدمن" can restore it — auth.uid() only ever
// reflects the admin while that stash+log step below runs.
export async function impersonateUser(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const targetId = formData.get("userId") as string;

  if (targetId === adminId) {
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("لا يمكنك الدخول كحسابك الخاص."));
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("email, display_name")
    .eq("id", targetId)
    .single();

  if (!targetProfile?.email) {
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("تعذّر الدخول كهذا المستخدم — لا يوجد بريد إلكتروني مسجل."));
  }

  const {
    data: { session: adminSession },
  } = await supabase.auth.getSession();

  if (!adminSession) redirect("/admin/login");

  // Logged while auth.uid() is still the admin, matching
  // admin_audit_log's insert policy (admin_id = auth.uid() AND is_admin).
  await logAdminAction(supabase, adminId, "impersonate_start", "user", targetId, {
    target_email: targetProfile.email,
  });

  const adminClient = createAdminClient();
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: targetProfile.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("تعذّر الدخول كهذا المستخدم. حاول مرة أخرى."));
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("تعذّر الدخول كهذا المستخدم. حاول مرة أخرى."));
  }

  const cookieStore = await cookies();
  cookieStore.set(
    IMPERSONATION_COOKIE,
    JSON.stringify({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
      admin_email: adminSession.user.email,
    }),
    { httpOnly: true, path: "/", maxAge: 60 * 60 * 4, sameSite: "lax" },
  );

  redirect("/dashboard");
}

export async function returnToAdmin() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  if (!raw) redirect("/admin");

  const { access_token, refresh_token } = JSON.parse(raw) as { access_token: string; refresh_token: string };
  const supabase = await createClient();
  await supabase.auth.setSession({ access_token, refresh_token });
  cookieStore.delete(IMPERSONATION_COOKIE);

  redirect("/admin/users");
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
    redirect(`/admin/users/${targetId}?error=` + encodeURIComponent("يجب إدخال سبب التعديل."));
  }

  const { data: target } = await supabase.from("profiles").select("balance").eq("id", targetId).single();
  if (!target) {
    redirect("/admin/users?error=" + encodeURIComponent("المستخدم غير موجود."));
  }

  const newBalance = Number(target.balance) + delta;
  // balance has no direct-client UPDATE grant -- only the service-role
  // client can write it, so a customer can't set their own balance via a
  // raw API call.
  const { error } = await createAdminClient().from("profiles").update({ balance: newBalance }).eq("id", targetId);

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
  const shareRaw = ((formData.get("profitSharePct") as string) ?? "").trim();
  const shareNum = shareRaw === "" ? NaN : Number(shareRaw);
  // Display-only 0-50; blank / invalid / out of range -> NULL (not shown).
  const profitSharePct = Number.isFinite(shareNum) && shareNum >= 0 && shareNum <= 50 ? shareNum : null;

  return {
    display_name: displayName,
    bio: bio || null,
    skill: Math.min(0.85, Math.max(0.3, (Number.isFinite(skillPct) ? skillPct : 55) / 100)),
    min_copy_amount: Number.isFinite(minCopyAmount) && minCopyAmount > 0 ? minCopyAmount : 50,
    base_followers_count: Number.isFinite(baseFollowers) && baseFollowers >= 0 ? baseFollowers : 0,
    profit_share_pct: profitSharePct,
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

const AVATAR_BUCKET = "leader-avatars";
const AVATAR_MAX_BYTES = 1024 * 1024;
const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Removes the previously uploaded file (if the current avatar_url points into
// our bucket) so replacements don't leave orphans behind. Best-effort.
async function removeUploadedAvatar(currentUrl: string | null) {
  const marker = `/${AVATAR_BUCKET}/`;
  const i = currentUrl ? currentUrl.indexOf(marker) : -1;
  if (i < 0 || !currentUrl) return;
  await createAdminClient().storage.from(AVATAR_BUCKET).remove([currentUrl.slice(i + marker.length)]);
}

// Leaders are platform-generated (there is no leader-facing account), so the
// picture is managed here by admins: upload replaces the seeded generated
// avatar. Writes use the service-role client -- the bucket is public-read but
// has no client write policy.
export async function updateLeaderAvatar(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const providerId = formData.get("providerId") as string;
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/traders?error=" + encodeURIComponent("اختر صورة أولًا."));
  }
  const ext = AVATAR_TYPES[file.type];
  if (!ext) {
    redirect("/admin/traders?error=" + encodeURIComponent("صيغة الصورة غير مدعومة (PNG أو JPG أو WebP فقط)."));
  }
  if (file.size > AVATAR_MAX_BYTES) {
    redirect("/admin/traders?error=" + encodeURIComponent("حجم الصورة أكبر من 1 ميجابايت."));
  }

  const { data: current } = await supabase.from("providers").select("avatar_url").eq("id", providerId).single();

  const path = `${providerId}/${Date.now()}.${ext}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (uploadError) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر رفع الصورة: " + uploadError.message));
  }

  const publicUrl = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("providers").update({ avatar_url: publicUrl }).eq("id", providerId);
  if (error) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر حفظ رابط الصورة: " + error.message));
  }

  await removeUploadedAvatar(current?.avatar_url ?? null);
  await logAdminAction(supabase, adminId, "update_leader_avatar", "provider", providerId, { path });

  revalidatePath("/admin/traders");
  revalidatePath("/discover");
  revalidatePath(`/trader/${providerId}`);
  revalidatePath("/");
}

export async function resetLeaderAvatar(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const providerId = formData.get("providerId") as string;

  const { data: current } = await supabase.from("providers").select("avatar_url").eq("id", providerId).single();
  const { error } = await supabase
    .from("providers")
    .update({ avatar_url: defaultAvatarUrl(providerId) })
    .eq("id", providerId);
  if (error) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر إعادة الصورة الافتراضية: " + error.message));
  }

  await removeUploadedAvatar(current?.avatar_url ?? null);
  await logAdminAction(supabase, adminId, "reset_leader_avatar", "provider", providerId);

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

function readTradeFields(formData: FormData) {
  const symbol = formData.get("symbol") as string;
  const side = formData.get("side") as string;
  const entryPrice = Number(formData.get("entryPrice"));
  const stopLoss = formData.get("stopLoss") ? Number(formData.get("stopLoss")) : null;
  const takeProfit = formData.get("takeProfit") ? Number(formData.get("takeProfit")) : null;
  return { symbol, side, entryPrice, stopLoss, takeProfit };
}

// Adding a trade at a trader mirrors to every active follower automatically,
// exactly like a real trade — reuses mirror_signal_to_followers() as-is.
export async function createTraderTrade(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const providerId = formData.get("providerId") as string;
  const { symbol, side, entryPrice, stopLoss, takeProfit } = readTradeFields(formData);

  if (!symbol || !side || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    redirect("/admin/traders?error=" + encodeURIComponent("بيانات الصفقة غير صالحة."));
  }

  const { data, error } = await supabase
    .from("signals")
    .insert({ provider_id: providerId, symbol, side, entry_price: entryPrice, stop_loss: stopLoss, take_profit: takeProfit })
    .select("id")
    .single();

  if (error) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر إنشاء الصفقة: " + error.message));
  }

  await logAdminAction(supabase, adminId, "create_trader_trade", "signal", data?.id ?? null, { providerId, symbol, side, entryPrice });

  revalidatePath("/admin/traders");
  revalidatePath(`/trader/${providerId}`);
}

export async function closeTraderTrade(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const signalId = formData.get("signalId") as string;
  const providerId = formData.get("providerId") as string;
  const exitPrice = Number(formData.get("exitPrice"));

  if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
    redirect("/admin/traders?error=" + encodeURIComponent("سعر الإغلاق غير صالح."));
  }

  const { error } = await supabase
    .from("signals")
    .update({ status: "closed", exit_price: exitPrice, closed_at: new Date().toISOString() })
    .eq("id", signalId)
    .eq("status", "open");

  if (error) {
    redirect("/admin/traders?error=" + encodeURIComponent("تعذّر إغلاق الصفقة: " + error.message));
  }

  await logAdminAction(supabase, adminId, "close_trader_trade", "signal", signalId, { exitPrice });

  revalidatePath("/admin/traders");
  revalidatePath(`/trader/${providerId}`);
}

// Adds a trade for exactly one client, independent of everyone else who
// might also copy the same trader. created_by_admin: true makes
// mirror_signal_to_followers() skip its normal "copy to every follower"
// insert, so this action inserts the single target position itself.
export async function addClientTrade(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const followerId = formData.get("followerId") as string;
  const providerId = formData.get("providerId") as string;
  const size = Number(formData.get("size"));
  const { symbol, side, entryPrice, stopLoss, takeProfit } = readTradeFields(formData);

  if (!symbol || !side || !Number.isFinite(entryPrice) || entryPrice <= 0) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("بيانات الصفقة غير صالحة."));
  }
  if (!Number.isFinite(size) || size <= 0) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("قيمة الصفقة غير صالحة."));
  }

  const { data: signal, error: signalError } = await supabase
    .from("signals")
    .insert({
      provider_id: providerId,
      symbol,
      side,
      entry_price: entryPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      created_by_admin: true,
    })
    .select("id")
    .single();

  if (signalError || !signal) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("تعذّر إنشاء الصفقة: " + signalError?.message));
  }

  const { error: positionError } = await supabase.from("simulated_positions").insert({
    signal_id: signal!.id,
    follower_id: followerId,
    entry_price: entryPrice,
    size,
    status: "open",
  });

  if (positionError) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("تعذّر إنشاء صفقة العميل: " + positionError.message));
  }

  await logAdminAction(supabase, adminId, "add_client_trade", "simulated_position", signal!.id, {
    followerId,
    providerId,
    symbol,
    side,
    entryPrice,
    size,
  });

  revalidatePath(`/admin/users/${followerId}`);
  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
}

export async function closeClientTrade(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const signalId = formData.get("signalId") as string;
  const followerId = formData.get("followerId") as string;
  const exitPrice = Number(formData.get("exitPrice"));

  if (!Number.isFinite(exitPrice) || exitPrice <= 0) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("سعر الإغلاق غير صالح."));
  }

  const { error } = await supabase
    .from("signals")
    .update({ status: "closed", exit_price: exitPrice, closed_at: new Date().toISOString() })
    .eq("id", signalId)
    .eq("status", "open");

  if (error) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("تعذّر إغلاق الصفقة: " + error.message));
  }

  await logAdminAction(supabase, adminId, "close_client_trade", "signal", signalId, { followerId, exitPrice });

  revalidatePath(`/admin/users/${followerId}`);
}

// The only path that touches an already-settled trade — recomputes pnl
// with the same formula close_simulated_positions() uses, adjusts the
// client's balance by exactly the delta (never re-applies the old
// amount), and records the correction like any other manual adjustment.
export async function editClosedClientPosition(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const positionId = formData.get("positionId") as string;
  const followerId = formData.get("followerId") as string;
  const newExitPrice = Number(formData.get("newExitPrice"));

  if (!Number.isFinite(newExitPrice) || newExitPrice <= 0) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("سعر الإغلاق الجديد غير صالح."));
  }

  const { data: position } = (await supabase
    .from("simulated_positions")
    .select("id, entry_price, size, pnl, follower_id, signals(side)")
    .eq("id", positionId)
    .single()) as {
    data: {
      id: string;
      entry_price: number;
      size: number;
      pnl: number | null;
      follower_id: string;
      signals: { side: string } | { side: string }[] | null;
    } | null;
  };

  if (!position) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("الصفقة غير موجودة."));
  }

  const side = Array.isArray(position!.signals) ? position!.signals[0]?.side : position!.signals?.side;
  const sign = side === "sell" ? -1 : 1;
  const newPnl =
    ((newExitPrice - Number(position!.entry_price)) / Number(position!.entry_price)) * Number(position!.size) * sign;
  const delta = newPnl - Number(position!.pnl ?? 0);

  const { error: posError } = await supabase
    .from("simulated_positions")
    .update({ exit_price: newExitPrice, pnl: newPnl })
    .eq("id", positionId);

  if (posError) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("تعذّر تعديل الصفقة: " + posError.message));
  }

  const { data: profile } = await supabase.from("profiles").select("balance").eq("id", followerId).single();
  const newBalance = Number(profile?.balance ?? 0) + delta;

  await createAdminClient().from("profiles").update({ balance: newBalance }).eq("id", followerId);

  await supabase.from("wallet_transactions").insert({
    user_id: followerId,
    type: "admin_adjustment",
    amount: delta,
    balance_after: newBalance,
    note: `تعديل إداري لنتيجة صفقة مغلقة (سعر إغلاق جديد: ${newExitPrice})`,
  });

  await logAdminAction(supabase, adminId, "edit_closed_client_position", "simulated_position", positionId, {
    followerId,
    newExitPrice,
    newPnl,
    delta,
  });

  revalidatePath(`/admin/users/${followerId}`);
  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
}

// Builds a realistic margin-call-style loss trade for one client: looks
// at the platform's own two most recent signals for the chosen symbol to
// find the current price and recent direction, picks the side that
// loses if that direction continues, and computes a real lot size from
// the client's capital and the requested pip distance (see
// src/lib/pip-specs.ts) — instead of the admin typing arbitrary prices.
//
// scope controls who else sees this trade:
// - "real_only" (default, original behavior): fully isolated
//   (created_by_admin = true) — invisible to everyone but this one
//   client, no effect on the leader's own public profile/stats.
// - "real_and_demo": the SAME entry/exit/timing becomes a genuine,
//   public signal for the leader (created_by_admin = false) — counted
//   in their stats and mirrored 1:1 through the existing trigger to
//   every OTHER follower (demo and real alike), each taking whatever
//   ordinary % loss that price move represents on their own balance.
//   The target client still gets their own precisely-calibrated
//   position on this same signal (unaffected by the normal mirror,
//   their subscription is briefly deactivated while the signal is
//   inserted so the trigger skips them), and the leader's own
//   total_profit/account_capital take a separate small 1-10% hit —
//   so the leader's public trade looks like an ordinary loss, not the
//   client's full-balance wipeout.
export async function addMarginCallTrade(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const followerId = formData.get("followerId") as string;
  const providerId = formData.get("providerId") as string;
  const symbol = formData.get("symbol") as string;
  const lossAmount = Math.abs(Number(formData.get("lossAmount")));
  const scope = formData.get("scope") === "real_and_demo" ? "real_and_demo" : "real_only";
  // Pips isn't a user input anymore — pick a realistic random distance
  // ourselves so every margin-call trade doesn't look identical.
  const pips = 30 + Math.random() * 120;

  if (!symbol) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("اختر رمزًا."));
  }
  if (!Number.isFinite(lossAmount) || lossAmount <= 0) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("قيمة الخسارة غير صالحة."));
  }

  const [{ data: profile }, { data: provider }] = await Promise.all([
    supabase.from("profiles").select("balance").eq("id", followerId).single(),
    supabase.from("providers").select("display_name, account_capital, total_profit").eq("id", providerId).single(),
  ]);
  if (!profile) {
    redirect("/admin/users?error=" + encodeURIComponent("المستخدم غير موجود."));
  }
  const targetLoss = Math.min(lossAmount, Number(profile!.balance));
  if (targetLoss <= 0) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("رصيد العميل صفر، لا توجد خسارة ممكنة."));
  }

  const [{ data: recentSignals }, { data: realPrice }] = await Promise.all([
    supabase
      .from("signals")
      .select("entry_price, exit_price, status, opened_at")
      .eq("symbol", symbol)
      .order("opened_at", { ascending: false })
      .limit(2),
    supabase.from("market_prices").select("price").eq("symbol", symbol).maybeSingle(),
  ]);

  const priceOf = (s: { entry_price: number; exit_price: number | null; status: string }) =>
    s.status === "closed" && s.exit_price != null ? Number(s.exit_price) : Number(s.entry_price);

  let currentPrice: number;
  let trendUp: boolean;
  if (recentSignals && recentSignals.length >= 2) {
    // The real, live market_prices feed (updated every minute) is fresher
    // than the last simulated signal (which can be several minutes old),
    // but trend still comes from the platform's own recent signal history —
    // real_prices only ever holds one current value per symbol, not a series.
    currentPrice = realPrice ? Number(realPrice.price) : priceOf(recentSignals[0]);
    trendUp = priceOf(recentSignals[0]) >= priceOf(recentSignals[1]);
  } else if (recentSignals && recentSignals.length === 1) {
    currentPrice = realPrice ? Number(realPrice.price) : priceOf(recentSignals[0]);
    trendUp = Math.random() < 0.5;
  } else if (realPrice) {
    currentPrice = Number(realPrice.price);
    trendUp = Math.random() < 0.5;
  } else {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("لا توجد بيانات سعرية كافية لهذا الرمز حتى الآن."));
  }

  const side = trendUp ? "sell" : "buy";
  const { lotSize, actualLossUsd, sizeDollars, pipSize } = computeLotSize(symbol, pips, targetLoss, currentPrice!);
  const priceMove = pips * pipSize;
  const entryPrice = currentPrice!;
  const exitPrice = trendUp ? entryPrice + priceMove : entryPrice - priceMove;

  // real_and_demo needs the service-role client: it inserts a
  // created_by_admin = false signal (so it mirrors normally, per
  // signals_insert_admin) and, in the same flow, a simulated_positions
  // row on that signal for the target client -- simulated_positions_insert_admin
  // only allows that when the linked signal is created_by_admin = true,
  // which this deliberately isn't.
  const db = scope === "real_and_demo" ? createAdminClient() : supabase;

  if (scope === "real_and_demo") {
    // Deactivate the target's own subscription for a moment so the
    // mirror trigger (fires on the insert below) skips them -- they get
    // their own precisely-calibrated position instead, right after.
    await db.from("subscriptions").update({ is_active: false }).eq("follower_id", followerId).eq("provider_id", providerId);
  }

  const { data: signal, error: signalError } = await db
    .from("signals")
    .insert({ provider_id: providerId, symbol, side, entry_price: entryPrice, created_by_admin: scope === "real_only" })
    .select("id")
    .single();

  if (scope === "real_and_demo") {
    await db.from("subscriptions").update({ is_active: true }).eq("follower_id", followerId).eq("provider_id", providerId);
  }

  if (signalError || !signal) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("تعذّر إنشاء الصفقة: " + signalError?.message));
  }

  const { error: positionError } = await db.from("simulated_positions").insert({
    signal_id: signal!.id,
    follower_id: followerId,
    entry_price: entryPrice,
    size: sizeDollars,
    status: "open",
  });

  if (positionError) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("تعذّر إنشاء صفقة العميل: " + positionError.message));
  }

  const { error: closeError } = await db
    .from("signals")
    .update({ status: "closed", exit_price: exitPrice, closed_at: new Date().toISOString() })
    .eq("id", signal!.id);

  if (closeError) {
    redirect(`/admin/users/${followerId}?error=` + encodeURIComponent("تعذّر تسوية الصفقة: " + closeError.message));
  }

  if (scope === "real_and_demo") {
    // The leader's own public trade should look like an ordinary loss,
    // not the client's full-balance wipeout -- a separate, modest 1-10%
    // hit to their own capital, independent of the client's calibrated size.
    const leaderLossPct = 1 + Math.random() * 9;
    const leaderCapital = Number(provider?.account_capital ?? 2000);
    const leaderLoss = Math.round((leaderLossPct / 100) * leaderCapital * 100) / 100;
    await db
      .from("providers")
      .update({
        account_capital: Math.max(50, leaderCapital - leaderLoss),
        total_profit: Number(provider?.total_profit ?? 0) - leaderLoss,
      })
      .eq("id", providerId);
  }

  const sideLabel = side === "buy" ? "شراء" : "بيع";
  const providerName = provider?.display_name ?? "متداول غير معروف";
  await supabase.from("notifications").insert({
    user_id: followerId,
    type: "margin_call",
    title: "إشعار تصفية إجبارية (Stop Out)",
    body:
      `عميلنا الكريم،\n` +
      `نفيدكم بأنه تم إغلاق أحد مراكزكم المفتوحة تلقائيًا بعد وصول رصيد حسابكم المتاح إلى الحد الأدنى المسموح به، وذلك حفاظًا على حسابكم من الدخول في رصيد سالب.\n\n` +
      `تفاصيل الصفقة:\n` +
      `— الأداة: ${symbol}\n` +
      `— الاتجاه: ${sideLabel}\n` +
      `— المتداول المنسوخ: ${providerName}\n` +
      `— النتيجة النهائية: -${actualLossUsd.toFixed(2)}$\n\n` +
      `سبب الإغلاق: لم يكن للصفقة مستوى وقف خسارة (Stop Loss) محدد، ما أدى إلى استمرار تحرك السوق ضدها حتى وصول الحساب إلى مستوى التصفية الإجبارية.\n\n` +
      `نوصي دائمًا بتحديد مستوى وقف خسارة مناسب عند نسخ الصفقات، لإدارة المخاطر وحماية رأس مالكم من تقلبات السوق مستقبلًا.`,
  });

  await logAdminAction(supabase, adminId, "add_margin_call_trade", "simulated_position", signal!.id, {
    followerId,
    providerId,
    symbol,
    side,
    pips,
    lotSize,
    entryPrice,
    exitPrice,
    targetLoss,
    actualLoss: actualLossUsd,
    trendUp,
    scope,
  });

  revalidatePath(`/admin/users/${followerId}`);
  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
  if (scope === "real_and_demo") {
    revalidatePath(`/trader/${providerId}`);
  }
}

// ---- Lead trader applications (see LEADER_TASKS.md Phase 1) -----------------

export async function approveLeadTraderApplication(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const applicationId = formData.get("applicationId") as string;

  const { data: app } = await supabase
    .from("lead_trader_applications")
    .select("id, user_id, display_name, bio, requested_min_investment, status")
    .eq("id", applicationId)
    .single();

  if (!app || app.status !== "pending") {
    redirect("/admin/lead-trader-applications?error=" + encodeURIComponent("الطلب غير موجود أو تمت مراجعته بالفعل."));
  }

  // One provider row per approved leader, linked back via user_id -- the same
  // column providers already has, just used for a real applicant instead of a
  // platform-generated leader (see 0180's comment: previously always null).
  const minCopy = Number(app!.requested_min_investment);
  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .insert({
      user_id: app!.user_id,
      display_name: app!.display_name,
      bio: app!.bio,
      min_copy_amount: Number.isFinite(minCopy) && minCopy > 0 ? minCopy : 100,
      skill: 0.55,
      base_followers_count: 0,
    })
    .select("id")
    .single();

  if (providerError || !provider) {
    redirect("/admin/lead-trader-applications?error=" + encodeURIComponent("تعذّر إنشاء حساب المتداول: " + (providerError?.message ?? "")));
  }

  await supabase
    .from("lead_trader_applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewer_admin_id: adminId, provider_id: provider!.id })
    .eq("id", applicationId);

  // is_lead_trader is locked down like is_admin/is_suspended (0180) -- only the
  // service-role client may set it.
  await createAdminClient().from("profiles").update({ is_lead_trader: true }).eq("id", app!.user_id);

  await logAdminAction(supabase, adminId, "approve_lead_trader_application", "lead_trader_application", applicationId, {
    provider_id: provider!.id,
  });

  revalidatePath("/admin/lead-trader-applications");
}

export async function rejectLeadTraderApplication(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const applicationId = formData.get("applicationId") as string;
  const reason = ((formData.get("reason") as string) ?? "").trim();

  await supabase
    .from("lead_trader_applications")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewer_admin_id: adminId, rejection_reason: reason || null })
    .eq("id", applicationId)
    .eq("status", "pending");

  await logAdminAction(supabase, adminId, "reject_lead_trader_application", "lead_trader_application", applicationId, { reason });

  revalidatePath("/admin/lead-trader-applications");
}

// ---- Profit-share settlement apply (Phase 5) --------------------------------
// Actually moves money for 'pending' profit_share_ledger rows -- gated by
// LEAD_TRADER_MONEY_ENABLED (off by default) AND demo accounts only, per the
// approved plan. lead_trader_run_own_settlement()/admin_run_all_lead_trader_settlements()
// (0206) only ever compute and record; this is the one place that debits/credits
// balances, and only through the service-role client (profiles.balance is
// locked down to it, same as adjustBalance()).
export async function applyLeadTraderSettlements(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const providerId = formData.get("providerId") as string;

  const { LEAD_TRADER_MONEY_ENABLED } = await import("@/config/lead-trader");
  if (!LEAD_TRADER_MONEY_ENABLED) {
    redirect("/admin/traders?error=" + encodeURIComponent("ميزة تحويل مشاركة الأرباح الفعلية معطّلة حاليًا (feature flag)."));
  }

  const { data: pending } = await supabase
    .from("profit_share_ledger")
    .select("id, follower_id, profit_share_amount, provider_id")
    .eq("provider_id", providerId)
    .eq("status", "pending");

  const admin = createAdminClient();
  const { data: provider } = await supabase.from("providers").select("user_id").eq("id", providerId).single();
  let settledCount = 0;

  for (const row of pending ?? []) {
    const { data: followerProfile } = await admin.from("profiles").select("balance, account_type").eq("id", row.follower_id).single();
    if (!followerProfile || followerProfile.account_type !== "demo") continue; // real accounts excluded regardless of the flag

    const amount = Number(row.profit_share_amount);
    const newFollowerBalance = Number(followerProfile.balance) - amount;
    await admin.from("profiles").update({ balance: newFollowerBalance }).eq("id", row.follower_id);
    await admin.from("wallet_transactions").insert({ user_id: row.follower_id, type: "fee", amount: -amount, balance_after: newFollowerBalance, note: "مشاركة أرباح للمتداول القائد" });

    if (provider?.user_id) {
      const { data: leaderProfile } = await admin.from("profiles").select("balance").eq("id", provider.user_id).single();
      if (leaderProfile) {
        const newLeaderBalance = Number(leaderProfile.balance) + amount;
        await admin.from("profiles").update({ balance: newLeaderBalance }).eq("id", provider.user_id);
        await admin.from("wallet_transactions").insert({ user_id: provider.user_id, type: "admin_adjustment", amount, balance_after: newLeaderBalance, note: "مشاركة أرباح من متابع" });
      }
    }

    await admin.from("profit_share_ledger").update({ status: "settled", settled_at: new Date().toISOString() }).eq("id", row.id);
    settledCount += 1;
  }

  await logAdminAction(supabase, adminId, "apply_lead_trader_settlements", "provider", providerId, { settledCount });
  revalidatePath("/admin/traders");
}

// ---- Lead trader payout requests (leader dashboard phase 3) ------------------
// A request is only creatable for amounts <= the leader's settled profit-share
// earnings (enforced in lead_dashboard_request_payout, 0212). Approving it
// debits the leader's balance (service role -- profiles.balance is locked to
// it) and logs a wallet transaction; the transfer itself happens off-platform.
export async function approveLeadPayout(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const id = formData.get("requestId") as string;
  const note = ((formData.get("note") as string) || "").trim() || null;

  const { data: req } = await supabase.from("lead_trader_payout_requests").select("id, user_id, amount, status").eq("id", id).single();
  if (!req || req.status !== "pending") redirect("/admin/lead-payouts?error=" + encodeURIComponent("الطلب غير موجود أو تمت مراجعته."));

  const admin = createAdminClient();
  const { data: leader } = await admin.from("profiles").select("balance").eq("id", req.user_id).single();
  const amount = Number(req.amount);
  if (!leader || Number(leader.balance) < amount) {
    redirect("/admin/lead-payouts?error=" + encodeURIComponent("رصيد القائد لا يكفي لهذا السحب."));
  }

  const { data: claimed } = await admin
    .from("lead_trader_payout_requests")
    .update({ status: "approved", admin_note: note, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) redirect("/admin/lead-payouts?error=" + encodeURIComponent("تمت مراجعة الطلب بالفعل."));

  const newBalance = Number(leader.balance) - amount;
  const { data: debited } = await admin.from("profiles").update({ balance: newBalance }).eq("id", req.user_id).eq("balance", leader.balance).select("id");
  if (!debited?.length) {
    await admin.from("lead_trader_payout_requests").update({ status: "pending", reviewed_at: null }).eq("id", id);
    redirect("/admin/lead-payouts?error=" + encodeURIComponent("تغيّر رصيد القائد أثناء المعالجة، أعد المحاولة."));
  }
  await admin.from("wallet_transactions").insert({ user_id: req.user_id, type: "withdrawal", amount: -amount, balance_after: newBalance, note: "سحب أرباح المتداول القائد" });
  await admin.from("notifications").insert({
    user_id: req.user_id,
    type: "lead_payout_reviewed",
    title: "تمت الموافقة على طلب سحب الأرباح",
    body: null,
    data: { amount, approved: true },
  });

  await logAdminAction(supabase, adminId, "approve_lead_payout", "lead_trader_payout_request", id, { amount });
  revalidatePath("/admin/lead-payouts");
}

export async function rejectLeadPayout(formData: FormData) {
  const { supabase, adminId } = await assertAdmin();
  const id = formData.get("requestId") as string;
  const note = ((formData.get("note") as string) || "").trim() || null;

  const admin = createAdminClient();
  const { data: rejected } = await admin
    .from("lead_trader_payout_requests")
    .update({ status: "rejected", admin_note: note, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("user_id, amount");
  if (rejected?.length) {
    await admin.from("notifications").insert({
      user_id: rejected[0].user_id,
      type: "lead_payout_reviewed",
      title: "تم رفض طلب سحب الأرباح",
      body: null,
      data: { amount: Number(rejected[0].amount), approved: false },
    });
  }

  await logAdminAction(supabase, adminId, "reject_lead_payout", "lead_trader_payout_request", id, { note });
  revalidatePath("/admin/lead-payouts");
}
