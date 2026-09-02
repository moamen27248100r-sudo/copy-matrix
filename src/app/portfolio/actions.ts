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

  const { error } = await supabase.from("wallet_requests").insert({
    user_id: user.id,
    type: "deposit",
    amount,
    note,
  });

  if (error) {
    redirect("/portfolio?error=" + encodeURIComponent("تعذّر إرسال طلب الإيداع. حاول مرة أخرى."));
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

  const { error } = await supabase.from("wallet_requests").insert({
    user_id: user.id,
    type: "withdrawal",
    amount,
  });

  if (error) {
    redirect("/portfolio?error=" + encodeURIComponent("تعذّر إرسال طلب السحب. حاول مرة أخرى."));
  }

  revalidatePath("/portfolio");
  redirect("/portfolio?success=1");
}
