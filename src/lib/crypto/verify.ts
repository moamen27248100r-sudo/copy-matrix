// On-chain verification of a USDT deposit by its transaction hash, using free public APIs:
//   TRC20         -> TronGrid (https://api.trongrid.io), optional key TRONGRID_API_KEY
//   BEP20 / ERC20 -> Etherscan API V2 (one key, ETHERSCAN_API_KEY, chainid 56 / 1), or a JSON-RPC
//                    endpoint (BSC_RPC_URL / ETH_RPC_URL) when set -- same receipt data either way.
// It only reports what the chain says (recipient, token contract, amount, confirmations); the
// decision (wait / credit / fail) is taken by public.crypto_deposit_record_check() in the database.
// The fetch function is injectable so tests can replay recorded API responses.
import { CHAINS, tronAddressToHex, unitsToDecimal, type NetworkId } from "./networks.ts";

export type VerifyResult =
  | { state: "found"; amount: string; confirmations: number; from: string | null; block: number }
  | { state: "not_found" }
  | { state: "failed"; reason: "wrong_recipient" | "wrong_token" | "tx_failed" }
  | { state: "error"; message: string };

export type VerifyConfig = {
  trongridApiKey?: string;
  etherscanApiKey?: string;
  rpcUrls?: Partial<Record<"BEP20" | "ERC20", string>>;
  trongridUrl?: string;
  fetch?: typeof fetch;
};

const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

class ProviderError extends Error {}

const strip0x = (v: string) => v.toLowerCase().replace(/^0x/, "");
const topicFor = (hex20: string) => "0".repeat(24) + strip0x(hex20);

async function getJson(f: typeof fetch, url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await f(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch (e) {
    throw new ProviderError(`network: ${(e as Error).message}`);
  }
  if (!res.ok) throw new ProviderError(`http ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new ProviderError("invalid json");
  }
}

type Log = { address: string; topics: string[]; data: string };

// Sums the USDT transfers to `toHex20` and classifies the miss cases.
function classifyTransfers(logs: Log[], contractHex20: string, toHex20: string, nativeRecipient: string | null) {
  const ourTopic = topicFor(toHex20);
  const toUs = logs.filter(
    (l) => l.topics.length === 3 && strip0x(l.topics[0]) === TRANSFER_TOPIC && strip0x(l.topics[2]) === ourTopic,
  );
  const usdt = toUs.filter((l) => strip0x(l.address) === strip0x(contractHex20));
  if (usdt.length > 0) {
    const units = usdt.reduce((sum, l) => sum + BigInt("0x" + (strip0x(l.data) || "0")), BigInt(0));
    const fromTopic = strip0x(usdt[0].topics[1]);
    return { ok: true as const, units, fromHex20: fromTopic.slice(-40) };
  }
  // Something reached our address, but not USDT on this network (another token or the native coin).
  if (toUs.length > 0 || (nativeRecipient && strip0x(nativeRecipient) === strip0x(toHex20))) {
    return { ok: false as const, reason: "wrong_token" as const };
  }
  return { ok: false as const, reason: "wrong_recipient" as const };
}

// EVM (BEP20 / ERC20) -----------------------------------------------------------------------------
type Receipt = { status?: string; blockNumber?: string; to?: string | null; from?: string; logs?: Log[] } | null;

async function evmCall(network: "BEP20" | "ERC20", method: string, params: unknown[], cfg: VerifyConfig): Promise<unknown> {
  const f = cfg.fetch ?? fetch;
  const rpcUrl = cfg.rpcUrls?.[network];
  if (rpcUrl) {
    const body = (await getJson(f, rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })) as { result?: unknown; error?: { message?: string } };
    if (body.error) throw new ProviderError(`rpc: ${body.error.message ?? "error"}`);
    return body.result ?? null;
  }
  if (!cfg.etherscanApiKey) throw new ProviderError("ETHERSCAN_API_KEY is not set");
  const qs = new URLSearchParams({
    chainid: String(CHAINS[network].chainId),
    module: "proxy",
    action: method,
    apikey: cfg.etherscanApiKey,
  });
  if (method === "eth_getTransactionReceipt") qs.set("txhash", String(params[0]));
  const body = (await getJson(f, `https://api.etherscan.io/v2/api?${qs}`)) as {
    result?: unknown;
    status?: string;
    message?: string;
    error?: { message?: string };
  };
  // Proxy calls answer in JSON-RPC shape; account errors (bad key, plan, rate limit) as status "0".
  if (body.error) throw new ProviderError(`etherscan: ${body.error.message ?? "error"}`);
  if (body.status === "0") throw new ProviderError(`etherscan: ${String(body.result ?? body.message)}`);
  return body.result ?? null;
}

async function verifyEvm(network: "BEP20" | "ERC20", hash: string, depositAddress: string, cfg: VerifyConfig): Promise<VerifyResult> {
  const receipt = (await evmCall(network, "eth_getTransactionReceipt", [`0x${hash}`], cfg)) as Receipt;
  if (!receipt || !receipt.blockNumber) return { state: "not_found" };
  if (receipt.status === "0x0") return { state: "failed", reason: "tx_failed" };

  const chain = CHAINS[network];
  const found = classifyTransfers(receipt.logs ?? [], chain.usdtContract, depositAddress, receipt.to ?? null);
  if (!found.ok) return { state: "failed", reason: found.reason };

  const latestHex = (await evmCall(network, "eth_blockNumber", [], cfg)) as string | null;
  if (typeof latestHex !== "string") throw new ProviderError("no latest block");
  const block = Number(BigInt(receipt.blockNumber));
  const latest = Number(BigInt(latestHex));
  return {
    state: "found",
    amount: unitsToDecimal(found.units, chain.decimals),
    confirmations: Math.max(0, latest - block + 1),
    from: `0x${found.fromHex20}`,
    block,
  };
}

// TRON (TRC20) ------------------------------------------------------------------------------------
type TronInfo = {
  id?: string;
  blockNumber?: number;
  result?: string;
  receipt?: { result?: string };
  log?: { address: string; topics: string[]; data: string }[];
};

async function tronPost(path: string, body: unknown, cfg: VerifyConfig): Promise<unknown> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.trongridApiKey) headers["TRON-PRO-API-KEY"] = cfg.trongridApiKey;
  return getJson(cfg.fetch ?? fetch, `${cfg.trongridUrl ?? "https://api.trongrid.io"}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function verifyTron(hash: string, depositAddress: string, cfg: VerifyConfig): Promise<VerifyResult> {
  const ourHex = tronAddressToHex(depositAddress);
  const contractHex = tronAddressToHex(CHAINS.TRC20.usdtContract);
  if (!ourHex || !contractHex) throw new ProviderError("invalid deposit address");

  const info = (await tronPost("/wallet/gettransactioninfobyid", { value: hash }, cfg)) as TronInfo;
  if (!info || !info.id || !info.blockNumber) return { state: "not_found" };
  if (info.result === "FAILED" || (info.receipt?.result && info.receipt.result !== "SUCCESS")) {
    return { state: "failed", reason: "tx_failed" };
  }

  let nativeRecipient: string | null = null;
  const logs = (info.log ?? []).map((l) => ({ address: l.address, topics: l.topics ?? [], data: l.data ?? "" }));
  const firstPass = classifyTransfers(logs, contractHex, ourHex, null);
  if (!firstPass.ok && firstPass.reason === "wrong_recipient") {
    // No token transfer to us: was it TRX / a TRC10 token sent straight to our address?
    const tx = (await tronPost("/wallet/gettransactionbyid", { value: hash }, cfg)) as {
      raw_data?: { contract?: { parameter?: { value?: { to_address?: string } } }[] };
    };
    const to = tx?.raw_data?.contract?.[0]?.parameter?.value?.to_address;
    if (to && to.length === 42) nativeRecipient = to.slice(2);
  }
  const found = nativeRecipient ? classifyTransfers(logs, contractHex, ourHex, nativeRecipient) : firstPass;
  if (!found.ok) return { state: "failed", reason: found.reason };

  const now = (await tronPost("/wallet/getblock", { detail: false }, cfg)) as {
    block_header?: { raw_data?: { number?: number } };
  };
  const latest = now?.block_header?.raw_data?.number;
  if (typeof latest !== "number") throw new ProviderError("no latest block");
  return {
    state: "found",
    amount: unitsToDecimal(found.units, CHAINS.TRC20.decimals),
    confirmations: Math.max(0, latest - info.blockNumber + 1),
    from: `41${found.fromHex20}`,
    block: info.blockNumber,
  };
}

/** `hash`: 64 lowercase hex characters (normalizeTxHash). Never throws. */
export async function verifyDeposit(network: NetworkId, hash: string, depositAddress: string, cfg: VerifyConfig): Promise<VerifyResult> {
  try {
    return network === "TRC20" ? await verifyTron(hash, depositAddress, cfg) : await verifyEvm(network, hash, depositAddress, cfg);
  } catch (e) {
    return { state: "error", message: (e as Error).message };
  }
}

export function verifyConfigFromEnv(): VerifyConfig {
  return {
    trongridApiKey: process.env.TRONGRID_API_KEY || undefined,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY || undefined,
    rpcUrls: { BEP20: process.env.BSC_RPC_URL || undefined, ERC20: process.env.ETH_RPC_URL || undefined },
  };
}
