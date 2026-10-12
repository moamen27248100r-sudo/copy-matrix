// Client-side hints for the copy amount. The database re-validates everything; this only explains,
// before submitting, why an amount would be refused.
export type CopyAmountIssue = "below_min" | "above_balance" | null;

export function copyAmountIssue(amount: number, minAmount: number, balance?: number | null): CopyAmountIssue {
  if (!Number.isFinite(amount)) return null; // empty field: the browser's own "required" handles it
  if (amount < minAmount) return "below_min";
  if (balance != null && amount > balance) return "above_balance";
  return null;
}

/** A safe starting amount: the leader's minimum, or the whole balance when that is all there is. */
export function defaultCopyAmount(minAmount: number, balance: number | null | undefined): number {
  if (balance == null || balance <= 0) return minAmount;
  return balance >= minAmount ? minAmount : balance;
}
