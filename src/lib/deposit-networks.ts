// Demo-only deposit currencies/networks for Copy Matrix's internal
// payment-gateway UI. The addresses below are made up for display
// purposes -- not real wallets, not monitored, and deliberately NOT
// valid checksums on their respective chains, so nothing sent to them by
// mistake would actually resolve to a spendable address. This platform
// is a simulation; no real crypto should ever be sent to any address
// shown here. Deposits/withdrawals are applied instantly to the
// internal balance regardless of what a customer enters -- there is no
// real blockchain monitoring behind this UI.
export type CryptoCurrency = {
  id: string;
  symbol: string;
  name: string;
  color: string; // brand-ish accent used by CryptoIcon
};

export type DepositNetwork = {
  id: string;
  currencyId: string;
  currency: string;
  network: string;
  label: string;
  address: string;
  minDeposit: number;
  confirmations: number;
  estMinutes: number; // rough estimated confirmation time, for display only
  feeUsd: number; // flat display-only network fee estimate
  recommended?: boolean;
};

export const CRYPTO_CURRENCIES: CryptoCurrency[] = [
  { id: "usdt", symbol: "USDT", name: "Tether", color: "#26A17B" },
  { id: "btc", symbol: "BTC", name: "Bitcoin", color: "#F7931A" },
  { id: "eth", symbol: "ETH", name: "Ethereum", color: "#627EEA" },
  { id: "sol", symbol: "SOL", name: "Solana", color: "#9945FF" },
  { id: "trx", symbol: "TRX", name: "Tron", color: "#FF060A" },
  { id: "usdc", symbol: "USDC", name: "USD Coin", color: "#2775CA" },
  { id: "bnb", symbol: "BNB", name: "BNB", color: "#F0B90B" },
];

export const DEPOSIT_NETWORKS: DepositNetwork[] = [
  {
    id: "usdt-trc20",
    currencyId: "usdt",
    currency: "USDT",
    network: "TRC20 (Tron)",
    label: "USDT — TRC20",
    address: "TXpN7mK4hLqR2vZ8wD3fS6cY1uB5eJ9gAx",
    minDeposit: 10,
    confirmations: 1,
    estMinutes: 2,
    feeUsd: 1,
    recommended: true,
  },
  {
    id: "usdt-bep20",
    currencyId: "usdt",
    currency: "USDT",
    network: "BEP20 (BNB Smart Chain)",
    label: "USDT — BEP20",
    address: "0x4c8e2a9f6b31d7c05e9a2f4b8d61c3e9a7f2b405",
    minDeposit: 10,
    confirmations: 15,
    estMinutes: 3,
    feeUsd: 0.5,
  },
  {
    id: "usdt-erc20",
    currencyId: "usdt",
    currency: "USDT",
    network: "ERC20 (Ethereum)",
    label: "USDT — ERC20",
    address: "0x7a3f9c2e8b45d16a0f9c3e7b2d85a4f16c9e3b70",
    minDeposit: 20,
    confirmations: 12,
    estMinutes: 8,
    feeUsd: 4,
  },
  {
    id: "usdt-sol",
    currencyId: "usdt",
    currency: "USDT",
    network: "Solana",
    label: "USDT — Solana",
    address: "8gV1KX9wYqB4dE7mR2tN5jL6pC3xA0uZfHsQ4nWkTy8",
    minDeposit: 10,
    confirmations: 1,
    estMinutes: 1,
    feeUsd: 0.25,
  },
  {
    id: "btc",
    currencyId: "btc",
    currency: "BTC",
    network: "Bitcoin",
    label: "Bitcoin (BTC)",
    address: "bc1qm34kx7vd2wjyq0ha8znsc6r5eu9pf3wg2ldxa8",
    minDeposit: 0.0005,
    confirmations: 2,
    estMinutes: 20,
    feeUsd: 3,
  },
  {
    id: "eth",
    currencyId: "eth",
    currency: "ETH",
    network: "Ethereum",
    label: "Ethereum (ETH)",
    address: "0x5b1e4a8f3c96d27b04e8f1a6c93d5b70e2a4f819",
    minDeposit: 0.01,
    confirmations: 12,
    estMinutes: 8,
    feeUsd: 4,
  },
  {
    id: "sol",
    currencyId: "sol",
    currency: "SOL",
    network: "Solana",
    label: "Solana (SOL)",
    address: "9hT4mNqZ2wR7xK1jD5vB8sC3fY6pL0eA4gXuQ7nMkVj9",
    minDeposit: 0.1,
    confirmations: 1,
    estMinutes: 1,
    feeUsd: 0.1,
  },
  {
    id: "trx",
    currencyId: "trx",
    currency: "TRX",
    network: "TRC20 (Tron)",
    label: "TRON (TRX)",
    address: "TAb8k2xQ9vD4mL7jR1nS5wY3uZ6cE0fHxK",
    minDeposit: 20,
    confirmations: 1,
    estMinutes: 2,
    feeUsd: 0.5,
  },
  {
    id: "usdc-erc20",
    currencyId: "usdc",
    currency: "USDC",
    network: "ERC20 (Ethereum)",
    label: "USDC — ERC20",
    address: "0x2f9a5c7e1b48d63a09f2e7c5b81d4a6f3e9c0b72",
    minDeposit: 10,
    confirmations: 12,
    estMinutes: 8,
    feeUsd: 4,
  },
  {
    id: "bnb",
    currencyId: "bnb",
    currency: "BNB",
    network: "BEP20 (BNB Smart Chain)",
    label: "BNB — BEP20",
    address: "0x91d3f6a8c25b07e4d9a1f8c36e5b02d7a4f9c318",
    minDeposit: 0.02,
    confirmations: 15,
    estMinutes: 3,
    feeUsd: 0.3,
  },
];

export function findDepositNetwork(id: string): DepositNetwork | undefined {
  return DEPOSIT_NETWORKS.find((n) => n.id === id);
}

export function networksForCurrency(currencyId: string): DepositNetwork[] {
  return DEPOSIT_NETWORKS.filter((n) => n.currencyId === currencyId);
}
