import { createAdminClient } from "@/lib/supabase/admin";
import { NETWORK_IDS, isNetworkId, type NetworkId } from "@/lib/crypto/networks";
import { verifyConfigFromEnv, verifyDeposit } from "@/lib/crypto/verify";

// Server-only deposit pipeline. Deposits are written exclusively by the service role through
// public.crypto_deposit_submit / crypto_deposit_record_check; customers can only read their rows.

export type NetworkSettings = {
  id: NetworkId;
  deposit_address: string | null;
  min_deposit: number;
  confirmations: number;
  withdraw_fee: number;
  min_withdraw: number;
  daily_withdraw_limit: number;
  deposit_enabled: boolean;
  withdraw_enabled: boolean;
};

export type DepositRow = {
  id: string;
  user_id: string;
  network: NetworkId;
  tx_hash: string;
  deposit_address: string;
  amount: number | null;
  confirmations: number;
  required_confirmations: number;
  status: "pending" | "completed" | "failed";
  failure_reason: string | null;
  created_at: string;
  completed_at: string | null;
};

export async function loadNetworkSettings(): Promise<NetworkSettings[]> {
  const { data } = await createAdminClient().from("crypto_networks").select("*").order("sort_order");
  return (data ?? [])
    .filter((n) => isNetworkId(n.id))
    .map((n) => ({
      ...n,
      min_deposit: Number(n.min_deposit),
      withdraw_fee: Number(n.withdraw_fee),
      min_withdraw: Number(n.min_withdraw),
      daily_withdraw_limit: Number(n.daily_withdraw_limit),
    })) as NetworkSettings[];
}

/** Networks a customer can deposit on right now, with the address they should send to. */
export async function depositOptionsFor(userId: string) {
  const admin = createAdminClient();
  const settings = await loadNetworkSettings();
  const options = await Promise.all(
    settings
      .filter((n) => n.deposit_enabled && n.deposit_address)
      .map(async (n) => {
        const { data: address } = await admin.rpc("crypto_deposit_address_for", { p_user: userId, p_network: n.id });
        return address ? { id: n.id, address: String(address), minDeposit: n.min_deposit, confirmations: n.confirmations } : null;
      }),
  );
  return options.filter((o): o is NonNullable<typeof o> => o != null);
}

/** Runs one on-chain check for a pending deposit and records the outcome. */
export async function checkDeposit(id: string): Promise<DepositRow | null> {
  const admin = createAdminClient();
  const { data: row } = await admin.from("crypto_deposits").select("*").eq("id", id).single();
  if (!row || row.status !== "pending" || !isNetworkId(row.network)) return (row as DepositRow) ?? null;
  const result = await verifyDeposit(row.network, row.tx_hash, row.deposit_address, verifyConfigFromEnv());
  if (result.state === "error") console.error(`crypto deposit ${id}: provider error: ${result.message}`);
  const { data: updated, error } = await admin.rpc("crypto_deposit_record_check", { p_id: id, p_result: result });
  if (error) throw error;
  return updated as DepositRow;
}

/** Checks every pending deposit that is due (optionally only one customer's). */
export async function processDueDeposits({ userId, limit = 25 }: { userId?: string; limit?: number } = {}) {
  let query = createAdminClient()
    .from("crypto_deposits")
    .select("id")
    .eq("status", "pending")
    .lte("next_check_at", new Date().toISOString())
    .order("next_check_at")
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query;
  let checked = 0;
  for (const { id } of data ?? []) {
    try {
      await checkDeposit(id);
      checked++;
    } catch (e) {
      console.error(`crypto deposit ${id}: check failed`, e);
    }
  }
  return checked;
}

export { NETWORK_IDS };
