import Link from "next/link";
import type { ReactNode } from "react";

// Shared empty state: icon slot, message, optional call-to-action link.
export function EmptyState({
  message,
  actionHref,
  actionLabel,
  icon,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-body text-muted">{message}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
