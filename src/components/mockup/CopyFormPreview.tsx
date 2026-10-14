"use client";

import { CopyFormView } from "@/components/CopyDialog";

// The real copy form (CopyFormView) with fixed values, for the home-page mock-up. The handlers do
// nothing; the screen is inert anyway.
export function CopyFormPreview({
  providerId,
  providerName,
  minAmount,
  defaultAmount,
  profitSharePct,
}: {
  providerId: string;
  providerName: string;
  minAmount: number;
  defaultAmount: number;
  profitSharePct: number;
}) {
  const noop = () => {};
  return (
    <CopyFormView
      providerId={providerId}
      providerName={providerName}
      defaultAmount={defaultAmount}
      minAmount={minAmount}
      balance={7768}
      profitSharePct={profitSharePct}
      amount={String(defaultAmount)}
      setAmount={noop}
      mode="ratio"
      setMode={noop}
      advanced={false}
      setAdvanced={noop}
      ack
      setAck={noop}
      onClose={noop}
    />
  );
}
