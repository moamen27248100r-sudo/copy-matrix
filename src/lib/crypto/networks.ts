// USDT networks the wallet supports. Everything here is fixed chain data (official USDT
// contracts, decimals, explorers); the per-network business settings (deposit address, minimums,
// fees, limits, switches) live in public.crypto_networks and are edited from the admin panel.
// No imports, so the unit tests can load this file directly.

export const NETWORK_IDS = ["TRC20", "BEP20", "ERC20"] as const;
export type NetworkId = (typeof NETWORK_IDS)[number];

export type ChainInfo = {
  kind: "tron" | "evm";
  /** Network name shown next to the standard ("Tron", "BNB Smart Chain", "Ethereum"). */
  chainName: string;
  /** EVM chain id (Etherscan API V2 `chainid`). */
  chainId?: number;
  /** Official USDT (Tether) contract on this chain. */
  usdtContract: string;
  decimals: number;
  /** Rough block time, for the estimated arrival time only. */
  blockSeconds: number;
  explorer: { tx: string; address: string };
};

export const CHAINS: Record<NetworkId, ChainInfo> = {
  TRC20: {
    kind: "tron",
    chainName: "Tron",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    decimals: 6,
    blockSeconds: 3,
    explorer: { tx: "https://tronscan.org/#/transaction/", address: "https://tronscan.org/#/address/" },
  },
  BEP20: {
    kind: "evm",
    chainName: "BNB Smart Chain",
    chainId: 56,
    usdtContract: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    blockSeconds: 3,
    explorer: { tx: "https://bscscan.com/tx/", address: "https://bscscan.com/address/" },
  },
  ERC20: {
    kind: "evm",
    chainName: "Ethereum",
    chainId: 1,
    usdtContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    blockSeconds: 12,
    explorer: { tx: "https://etherscan.io/tx/", address: "https://etherscan.io/address/" },
  },
};

/** "TRC20 (Tron)" */
export function networkLabel(id: NetworkId): string {
  return `${id} (${CHAINS[id].chainName})`;
}

export function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === "string" && (NETWORK_IDS as readonly string[]).includes(value);
}

// Same rules as public.crypto_address_valid().
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function isValidAddress(network: NetworkId, address: string): boolean {
  const a = address.trim();
  return CHAINS[network].kind === "tron" ? TRON_ADDRESS.test(a) : EVM_ADDRESS.test(a);
}

/** "0xABC…" / "abc" -> 64 lowercase hex characters (how hashes are stored), or null. */
export function normalizeTxHash(input: string): string | null {
  const h = input.trim().replace(/^0x/i, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(h) ? h : null;
}

/** Stored hash -> the form the chain's explorer and wallets show. */
export function displayTxHash(network: NetworkId, hash: string): string {
  return CHAINS[network].kind === "evm" ? `0x${hash}` : hash;
}

export function explorerTxUrl(network: NetworkId, hash: string): string {
  return CHAINS[network].explorer.tx + displayTxHash(network, hash);
}

export function explorerAddressUrl(network: NetworkId, address: string): string {
  return CHAINS[network].explorer.address + address;
}

export function estimatedMinutes(network: NetworkId, confirmations: number): number {
  return Math.max(1, Math.ceil((confirmations * CHAINS[network].blockSeconds) / 60));
}

export function shortAddress(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

// Base58Check (Tron addresses) ------------------------------------------------------------------
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(value: string): Uint8Array | null {
  let n = BigInt(0);
  for (const ch of value) {
    const i = BASE58_ALPHABET.indexOf(ch);
    if (i < 0) return null;
    n = n * BigInt(58) + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > BigInt(0)) {
    bytes.unshift(Number(n % BigInt(256)));
    n /= BigInt(256);
  }
  for (const ch of value) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Tron base58 address -> 20-byte hex (no 0x / 41 prefix), or null if malformed. */
export function tronAddressToHex(address: string): string | null {
  const bytes = base58Decode(address);
  if (!bytes || bytes.length !== 25 || bytes[0] !== 0x41) return null;
  return toHex(bytes.slice(1, 21));
}

/** Full Base58Check validation of a Tron address (format + checksum). */
export async function tronAddressChecksumOk(address: string): Promise<boolean> {
  if (!TRON_ADDRESS.test(address)) return false;
  const bytes = base58Decode(address);
  if (!bytes || bytes.length !== 25 || bytes[0] !== 0x41) return false;
  const payload = bytes.slice(0, 21);
  const first = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
  const second = new Uint8Array(await crypto.subtle.digest("SHA-256", first));
  return second.slice(0, 4).every((b, i) => b === bytes[21 + i]);
}

/** Integer token units -> exact decimal string ("1500000", 6 -> "1.5"). */
export function unitsToDecimal(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
