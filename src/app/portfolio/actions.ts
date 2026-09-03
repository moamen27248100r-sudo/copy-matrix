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
