import Link from "next/link";
import type { ReactNode } from "react";

// Shared empty state: an icon, a title, a one-line explanation and an action. `message` is the
// explanation; pass `title` when the screen has a short heading for it.
export function EmptyState({
  message,
  title,
  actionHref,
  actionLabel,
  icon,
}: {
  message: string;
  title?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] border border-border bg-surface p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-muted">
        {icon ?? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13" />
            <path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5.5a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2H3z" />
          </svg>
        )}
      </div>
      {title && <p className="text-section-title">{title}</p>}
      <p className={`max-w-sm text-base ${title ? "text-muted" : "text-muted"}`}>{message}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-1 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground transition hover:bg-accent-hover">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
