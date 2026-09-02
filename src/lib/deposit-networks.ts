// Demo-only deposit networks for Copy Matrix's internal payment-gateway UI.
// The addresses below are made up for display purposes — not real wallets,
// not monitored, and not valid checksums on their respective chains. This
// platform is a simulation; no real crypto should ever be sent to them.
export type DepositNetwork = {
  id: string;
  currency: string;
  network: string;
  label: string;
  address: string;
  minDeposit: number;
  confirmations: number;
};

export const DEPOSIT_NETWORKS: DepositNetwork[] = [
  {
    id: "usdt-trc20",
    currency: "USDT",
    network: "TRC20 (Tron)",
    label: "USDT — TRC20",
    address: "TXpN7mK4hLqR2vZ8wD3fS6cY1uB5eJ9gAx",
    minDeposit: 10,
    confirmations: 1,
  },
  {
    id: "usdt-bep20",
    currency: "USDT",
    network: "BEP20 (BNB Smart Chain)",
    label: "USDT — BEP20",
    address: "0x4c8e2a9f6b31d7c05e9a2f4b8d61c3e9a7f2b405",
    minDeposit: 10,
    confirmations: 15,
  },
  {
    id: "usdt-erc20",
    currency: "USDT",
    network: "ERC20 (Ethereum)",
    label: "USDT — ERC20",
    address: "0x7a3f9c2e8b45d16a0f9c3e7b2d85a4f16c9e3b70",
    minDeposit: 20,
    confirmations: 12,
  },
  {
    id: "btc",
    currency: "BTC",
    network: "Bitcoin",
    label: "Bitcoin (BTC)",
    address: "bc1qm34kx7vd2wjyq0ha8znsc6r5eu9pf3wg2ldxa8",
    minDeposit: 0.0005,
    confirmations: 2,
  },
];

export function findDepositNetwork(id: string): DepositNetwork | undefined {
  return DEPOSIT_NETWORKS.find((n) => n.id === id);
}
