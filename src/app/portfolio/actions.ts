"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findDepositNetwork } from "@/lib/deposit-networks";

export async function requestDeposit(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/portfolio?error=" + encodeURIComponent("مبلغ الإيداع يجب أن يكون رقمًا أكبر من صفر."));
  }

  const networkId = String(formData.get("network") ?? "");
  const network = findDepositNetwork(networkId);
  const note = network ? `الشبكة: ${network.label} — العنوان: ${network.address}` : null;

  // Deposits and withdrawals are processed instantly, not held for manual
  // admin review — insert then immediately approve in the same request, so
  // the existing balance-crediting trigger (apply_wallet_request, fires on
  // the pending -> approved transition) runs right away.
  const { data: inserted, error: insertError } = await supabase
    .from("wallet_requests")
    .insert({ user_id: user.id, type: "deposit", amount, note })
    .select("id")
    .single();

  if (insertError || !inserted) {
    redirect("/portfolio?error=" + encodeURIComponent("تعذّر إرسال طلب الإيداع. حاول مرة أخرى."));
  }

  const { error: approveError } = await supabase.rpc("self_approve_wallet_request", {
    p_request_id: inserted.id,
  });

  if (approveError) {
    redirect("/portfolio?error=" + encodeURIComponent("تعذّر إتمام الإيداع. حاول مرة أخرى."));
  }

  revalidatePath("/portfolio");
  redirect("/portfolio?success=1");
}

export async function requestWithdrawal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/portfolio?error=" + encodeURIComponent("مبلغ السحب يجب أن يكون رقمًا أكبر من صفر."));
  }

  // Pre-check before inserting the wallet_request row — apply_wallet_request()
  // (0091_reserve_allocated_capital.sql) enforces the same two rules at the
  // DB level as a safety net, but checking here first avoids leaving an
  // orphaned pending row every time a blocked withdrawal is attempted.
  const [{ count: openPositionsCount }, { data: activeSub }, { data: profile }] = await Promise.all([
    supabase
      .from("simulated_positions")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .eq("status", "open"),
    supabase
      .from("subscriptions")
      .select("allocated_amount, copy_started_at")
      .eq("follower_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("profiles").select("balance").eq("id", user.id).single(),
  ]);

  // Simulates the leader opening a trade 10 minutes after a copy starts —
  // from that point on, withdrawal is locked permanently, same as
  // stop_copy/apply_wallet_request (0096_fix_grace_period_direction.sql).
  const leaderHasTraded =
    !!activeSub?.copy_started_at && Date.now() - new Date(activeSub.copy_started_at).getTime() >= 10 * 60 * 1000;

  if ((openPositionsCount && openPositionsCount > 0) || leaderHasTraded) {
    redirect(
      "/portfolio?error=" +
        encodeURIComponent(
          "تعذّر تقديم طلب السحب: لديك صفقات مفتوحة حاليًا، ورصيدك محجوز كهامش لتغطيتها. يمكنك إيقاف النسخ بعد إغلاق الصفقات لإعادة الرصيد والأرباح إلى محفظتك، ثم إعادة تقديم طلب السحب.",
        ),
    );
  }

  const reserved = Number(activeSub?.allocated_amount ?? 0);
  const available = Number(profile?.balance ?? 0) - reserved;
  if (amount > available) {
    redirect(
      "/portfolio?error=" +
        encodeURIComponent(
          "رصيدك المتاح للسحب غير كافٍ — جزء من رصيدك محجوز حاليًا لحساب النسخ النشط. أوقف النسخ أولاً لإعادة هذا المبلغ إلى رصيدك المتاح.",
        ),
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("wallet_requests")
    .insert({ user_id: user.id, type: "withdrawal", amount })
    .select("id")
    .single();

  if (insertError || !inserted) {
    redirect("/portfolio?error=" + encodeURIComponent("تعذّر إرسال طلب السحب. حاول مرة أخرى."));
  }

  const { error: approveError } = await supabase.rpc("self_approve_wallet_request", {
    p_request_id: inserted.id,
  });

  if (approveError) {
    // apply_wallet_request() raises this exact Arabic message when the
    // balance doesn't cover the withdrawal — surface it as-is.
    redirect(
      "/portfolio?error=" +
        encodeURIComponent(approveError.message.includes("رصيد") ? approveError.message : "تعذّر إتمام السحب. حاول مرة أخرى."),
    );
  }

  revalidatePath("/portfolio");
  redirect("/portfolio?success=1");
}
