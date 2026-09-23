"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { findDepositNetwork } from "@/lib/deposit-networks";

export async function requestDeposit(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tp = await getTranslations("Actions.portfolio");

  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/portfolio?error=" + encodeURIComponent(tp("depositAmountInvalid")));
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
    redirect("/portfolio?error=" + encodeURIComponent(tp("depositRequestFailed")));
  }

  const { error: approveError } = await supabase.rpc("self_approve_wallet_request", {
    p_request_id: inserted.id,
  });

  if (approveError) {
    redirect("/portfolio?error=" + encodeURIComponent(tp("depositCompleteFailed")));
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

  const tp = await getTranslations("Actions.portfolio");

  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawAmountInvalid")));
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
    supabase.from("profiles").select("balance, account_type").eq("id", user.id).single(),
  ]);

  // Simulates the leader opening a trade 10 minutes after a copy starts —
  // from that point on, withdrawal is locked permanently, same as
  // stop_copy/apply_wallet_request (0096_fix_grace_period_direction.sql).
  const leaderHasTraded =
    !!activeSub?.copy_started_at && Date.now() - new Date(activeSub.copy_started_at).getTime() >= 10 * 60 * 1000;

  if ((openPositionsCount && openPositionsCount > 0) || leaderHasTraded) {
    redirect(
      "/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawBlockedOpenPositions")),
    );
  }

  const reserved = Number(activeSub?.allocated_amount ?? 0);
  const available = Number(profile?.balance ?? 0) - reserved;
  if (amount > available) {
    redirect(
      "/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawInsufficientAvailable")),
    );
  }

  // Real accounts need an actual destination — demo money doesn't go
  // anywhere real, so no address is collected for it.
  let note: string | null = null;
  if (profile?.account_type === "real") {
    const networkId = String(formData.get("network") ?? "");
    const walletAddress = String(formData.get("walletAddress") ?? "").trim();
    const network = findDepositNetwork(networkId);

    if (!network || !walletAddress) {
      redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawNetworkRequired")));
    }

    note = `السحب إلى: ${network.label} — العنوان: ${walletAddress}`;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("wallet_requests")
    .insert({ user_id: user.id, type: "withdrawal", amount, note })
    .select("id")
    .single();

  if (insertError || !inserted) {
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawRequestFailed")));
  }

  const { error: approveError } = await supabase.rpc("self_approve_wallet_request", {
    p_request_id: inserted.id,
  });

  if (approveError) {
    // apply_wallet_request() re-checks the same two conditions already
    // pre-checked above (as a race-condition safety net) and raises its own
    // Arabic-only exception message -- rather than surfacing that raw DB
    // text (which can't follow the viewer's locale), always show our own
    // translated fallback; the pre-checks above mean this DB-level path is
    // only ever hit on a genuine race, not the common case.
    redirect(
      "/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawCompleteFailed")),
    );
  }

  revalidatePath("/portfolio");
  redirect("/portfolio?success=1");
}
