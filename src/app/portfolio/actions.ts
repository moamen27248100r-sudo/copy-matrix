"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { findDepositNetwork } from "@/lib/deposit-networks";

async function requireRealAccount(returnPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("balance, account_type").eq("id", user.id).single();
  if (profile?.account_type !== "real") {
    const tp = await getTranslations("Actions.portfolio");
    redirect(`${returnPath}?error=` + encodeURIComponent(tp("realOnly")));
  }
  return { supabase, user, profile };
}

export async function requestDeposit(formData: FormData) {
  const { supabase, user } = await requireRealAccount("/portfolio/deposit");
  const tp = await getTranslations("Actions.portfolio");

  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/portfolio?error=" + encodeURIComponent(tp("depositAmountInvalid")));
  }

  const networkId = String(formData.get("network") ?? "");
  const network = findDepositNetwork(networkId);
  const note = network ? `Network: ${network.label} — Address: ${network.address}` : null;

  // Real deposits are created as 'pending' (processing) and only credited to
  // the real wallet once completed; users cannot complete their own request.
  const { error: insertError } = await supabase
    .from("wallet_requests")
    .insert({ user_id: user.id, type: "deposit", amount, note });

  if (insertError) {
    redirect("/portfolio?error=" + encodeURIComponent(tp("depositRequestFailed")));
  }

  revalidatePath("/portfolio");
  redirect("/portfolio?success=1");
}

export async function requestWithdrawal(formData: FormData) {
  const { supabase, user, profile } = await requireRealAccount("/portfolio/withdraw");
  const tp = await getTranslations("Actions.portfolio");

  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawAmountInvalid")));
  }

  // Pre-check before inserting the wallet_request row — apply_wallet_request()
  // enforces the same two rules at the DB level as a safety net, but checking
  // here first avoids leaving an orphaned pending row for a blocked withdrawal.
  const [{ count: openPositionsCount }, { data: activeSubs }] = await Promise.all([
    supabase
      .from("simulated_positions")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .eq("status", "open"),
    supabase
      .from("subscriptions")
      .select("allocated_amount, copy_started_at")
      .eq("follower_id", user.id)
      .eq("is_active", true),
  ]);

  // The leader is treated as having opened a trade 10 minutes after a copy
  // starts; from then on withdrawal stays locked until the copy is stopped.
  const leaderHasTraded = (activeSubs ?? []).some(
    (sub) => !!sub.copy_started_at && Date.now() - new Date(sub.copy_started_at).getTime() >= 10 * 60 * 1000,
  );

  if ((openPositionsCount && openPositionsCount > 0) || leaderHasTraded) {
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawBlockedOpenPositions")));
  }

  const reserved = (activeSubs ?? []).reduce((sum, sub) => sum + Number(sub.allocated_amount ?? 0), 0);
  const available = Number(profile?.balance ?? 0) - reserved;
  if (amount > available) {
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawInsufficientAvailable")));
  }

  const networkId = String(formData.get("network") ?? "");
  const walletAddress = String(formData.get("walletAddress") ?? "").trim();
  const network = findDepositNetwork(networkId);

  if (!network || !walletAddress) {
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawNetworkRequired")));
  }

  const note = `Withdraw to: ${network.label} — Address: ${walletAddress}`;

  const { error: insertError } = await supabase
    .from("wallet_requests")
    .insert({ user_id: user.id, type: "withdrawal", amount, note });

  if (insertError) {
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawRequestFailed")));
  }

  revalidatePath("/portfolio");
  redirect("/portfolio?success=1");
}

// Demo wallet: instant, server-side, touches only the demo balance. The DB
// functions refuse to run on a real account and are capped at the demo
// maximum, so nothing here can reach real funds.
async function runDemoWallet(
  fn: "demo_deposit" | "demo_withdraw" | "reset_demo_balance",
  amount: number | null,
  failPath: string,
  okPath: string,
): Promise<never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = amount == null ? await supabase.rpc(fn as "reset_demo_balance") : await supabase.rpc(fn as "demo_deposit", { p_amount: amount });

  if (error) {
    const tp = await getTranslations("Actions.portfolio");
    const msg =
      error.code === "CM011"
        ? tp("demoLimitExceeded")
        : error.code === "CM006"
          ? tp("withdrawInsufficientAvailable")
          : error.code === "CM010"
            ? tp("demoResetOpenPositions")
            : error.code === "CM014"
              ? tp("demoOnly")
              : tp("demoWalletFailed");
    redirect(`${failPath}?error=` + encodeURIComponent(msg));
  }

  revalidatePath("/portfolio");
  revalidatePath("/dashboard");
  redirect(okPath);
}

function parseAmount(formData: FormData) {
  const amount = Number(formData.get("amount"));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function demoDeposit(formData: FormData) {
  const amount = parseAmount(formData);
  if (amount == null) {
    const tp = await getTranslations("Actions.portfolio");
    redirect("/portfolio/deposit?error=" + encodeURIComponent(tp("depositAmountInvalid")));
  }
  await runDemoWallet("demo_deposit", amount, "/portfolio/deposit", "/portfolio?demo=deposit");
}

export async function demoWithdraw(formData: FormData) {
  const amount = parseAmount(formData);
  if (amount == null) {
    const tp = await getTranslations("Actions.portfolio");
    redirect("/portfolio/withdraw?error=" + encodeURIComponent(tp("withdrawAmountInvalid")));
  }
  await runDemoWallet("demo_withdraw", amount, "/portfolio/withdraw", "/portfolio?demo=withdraw");
}

export async function resetDemoBalance(formData?: FormData) {
  const returnTo = formData?.get("returnTo") === "/dashboard" ? "/dashboard" : "/portfolio";
  await runDemoWallet("reset_demo_balance", null, returnTo, `${returnTo}?demo=reset`);
}
