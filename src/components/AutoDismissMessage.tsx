"use client";

import { FlashMessage } from "@/components/ui/Toast";

// Kept for the pages that used it: the message is now a toast (success/info goes away by itself,
// an error stays until it is closed). `className` only tells the tone apart.
export function AutoDismissMessage({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
  clearParams?: string[];
  delayMs?: number;
}) {
  return <FlashMessage tone={/danger|error/.test(className) ? "error" : "success"}>{children}</FlashMessage>;
}
