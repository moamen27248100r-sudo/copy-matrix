"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasVerifiedTotp } from "@/lib/mfa";
import { attemptAllowed, CODE_PATTERN, readCode, verifiedTotpFactorId, verifyErrorKey } from "@/lib/mfa-verify";
import { CHAINS, isNetworkId, isValidAddress, normalizeTxHash, tronAddressChecksumOk } from "@/lib/crypto/networks";
import { checkDeposit, processDueDeposits } from "@/lib/crypto/deposits";
import { createAdminClient } from "@/lib/supabase/admin";

export type DepositFormState = { error?: string; submitted?: { status: string; confirmations: number; required: number; reason: string | null } };
export type WithdrawFormState = { error?: string };

const DEPOSIT_ERRORS: Record<string, string> = {
  CM012: "realOnly",
  CM030: "depositNetworkUnavailable",
  CM031: "txHashInvalid",
  CM032: "txAlreadySubmitted",
  CM033: "tooManyPendingDeposits",
  CM034: "tooManyDepositAttempts",
};

// Customer submits the TxID of a USDT transfer. The row is created by the service role and checked
// on-chain right away; anything still short of the required confirmations is re-checked by the
// cron route and while the customer keeps the page open.
export async function submitDepositTxid(_prev: DepositFormState, formData: FormData): Promise<DepositFormState> {
  const tp = await getTranslations("Actions.portfolio");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fportfolio%2Fdeposit");

  const network = String(formData.get("network") ?? "");
  const hash = normalizeTxHash(String(formData.get("txHash") ?? ""));
  if (!isNetworkId(network)) return { error: tp("depositNetworkUnavailable") };
  if (!hash) return { error: tp("txHashInvalid") };
  if (!(await checkRateLimit(`crypto-deposit:${user.id}`, 10, 600))) return { error: tp("tooManyDepositAttempts") };

  const { data: row, error } = await createAdminClient().rpc("crypto_deposit_submit", { p_user: user.id, p_network: network, p_tx_hash: hash });
  if (error || !row) return { error: tp(DEPOSIT_ERRORS[error?.code ?? ""] ?? "depositRequestFailed") };

  let checked = row as { id: string; status: string; confirmations: number; required_confirmations: number; failure_reason: string | null };
  try {
    checked = (await checkDeposit(checked.id)) ?? checked;
  } catch (e) {
    console.error("crypto deposit first check failed", e);
  }
  revalidatePath("/portfolio/deposit");
  revalidatePath("/portfolio/history");
  revalidatePath("/portfolio");
  return {
    submitted: {
      status: checked.status,
      confirmations: checked.confirmations,
      required: checked.required_confirmations,
      reason: checked.failure_reason,
    },
  };
}

// Polled by the deposit / history pages while a deposit is waiting for confirmations.
export async function refreshMyDeposits(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  if (!(await checkRateLimit(`crypto-deposit-refresh:${user.id}`, 12, 60))) return 0;
  const checked = await processDueDeposits({ userId: user.id, limit: 5 });
  if (checked > 0) {
    revalidatePath("/portfolio/deposit");
    revalidatePath("/portfolio/history");
    revalidatePath("/portfolio");
  }
  return checked;
}

const WITHDRAW_ERRORS: Record<string, string> = {
  CM001: "withdrawAmountInvalid",
  CM006: "withdrawInsufficientAvailable",
  CM012: "realOnly",
  CM023: "withdrawBlockedOpenPositions",
  CM024: "kycRequired",
  CM040: "mfaNotEnabled",
  CM041: "mfaCodeRequired",
  CM042: "withdrawSecurityLock",
  CM043: "withdrawNetworkUnavailable",
  CM044: "withdrawAddressInvalid",
  CM045: "withdrawBelowMin",
  CM046: "withdrawDailyLimit",
};

export async function requestCryptoWithdrawal(_prev: WithdrawFormState, formData: FormData): Promise<WithdrawFormState> {
  const tp = await getTranslations("Actions.portfolio");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fportfolio%2Fwithdraw");

  const network = String(formData.get("network") ?? "");
  const address = String(formData.get("address") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const code = readCode(formData);

  if (!isNetworkId(network)) return { error: tp("withdrawNetworkUnavailable") };
  if (!isValidAddress(network, address) || (CHAINS[network].kind === "tron" && !(await tronAddressChecksumOk(address)))) {
    return { error: tp("withdrawAddressInvalid") };
  }
  if (!Number.isFinite(amount) || amount <= 0) return { error: tp("withdrawAmountInvalid") };
  if (!hasVerifiedTotp(user)) return { error: tp("mfaNotEnabled") };

  // The 2FA code is checked by Supabase; the fresh aal2 token it returns is what the database
  // accepts as "code entered just now" (withdraw_mfa_check).
  const tf = await getTranslations("TwoFactor");
  if (!CODE_PATTERN.test(code)) return { error: tf("errCodeFormat") };
  if (!(await attemptAllowed(supabase, user.id))) return { error: tf("errTooManyAttempts") };
  const factorId = await verifiedTotpFactorId(supabase);
  if (!factorId) return { error: tp("mfaNotEnabled") };
  const { data: session, error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (mfaError || !session) return { error: tf(mfaError ? verifyErrorKey(mfaError) : "errGeneric") };

  const asUser = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const { error } = await asUser.rpc("request_crypto_withdrawal", { p_network: network, p_address: address, p_amount: amount });
  if (error) return { error: tp(WITHDRAW_ERRORS[error.code ?? ""] ?? "withdrawRequestFailed") };

  revalidatePath("/portfolio");
  revalidatePath("/portfolio/withdraw");
  revalidatePath("/portfolio/history");
  redirect("/portfolio/history?tab=withdrawals&requested=1");
}

export async function cancelCryptoWithdrawal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const back = formData.get("returnTo") === "/portfolio/withdraw" ? "/portfolio/withdraw" : "/portfolio/history?tab=withdrawals";
  const { error } = await supabase.rpc("cancel_crypto_withdrawal", { p_id: id });
  revalidatePath("/portfolio");
  revalidatePath("/portfolio/withdraw");
  revalidatePath("/portfolio/history");
  if (error) {
    const tp = await getTranslations("Actions.portfolio");
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=` + encodeURIComponent(tp("withdrawNotCancellable")));
  }
  redirect(`${back}${back.includes("?") ? "&" : "?"}cancelled=1`);
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
            : error.code === "CM023"
            ? tp("withdrawBlockedOpenPositions")
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
