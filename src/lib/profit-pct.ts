// How a return percentage is defined across the customer app (dashboard and portfolio).
//
//   return % = profit / net invested funds * 100
//
//   profit        realized results of closed trades + the floating result of open ones;
//   net invested  everything the customer ever put into the account (starting credit, deposits,
//                 adjustments) minus withdrawals. The database computes it as the current balance
//                 minus the lifetime trade results and fees on the wallet ledger (0254).
//
// This is the usual "profit over capital contributed" figure of professional platforms. It is NOT
// divided by today's balance: that figure shrinks the percentage after a gain and inflates it after
// a loss. When nothing has been invested yet (net invested <= 0) there is no meaningful percentage.

const MIN_BASE = 0.01;

export function profitPct(profit: number, netInvested: number | null | undefined): number | null {
  if (netInvested == null || !Number.isFinite(netInvested) || netInvested < MIN_BASE) return null;
  if (!Number.isFinite(profit)) return null;
  return (profit / netInvested) * 100;
}

// "+3.20%", "-1.05%", "0.00%" (no sign on a value that rounds to zero), "—" when undefined.
export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const r = Number(value.toFixed(decimals));
  return `${r > 0 ? "+" : r < 0 ? "-" : ""}${Math.abs(r).toFixed(decimals)}%`;
}
