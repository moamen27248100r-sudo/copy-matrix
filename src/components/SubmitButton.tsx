"use client";

import { useFormStatus } from "react-dom";

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// A submit button that disables itself and shows a spinner while its parent
// <form action={...}> is pending -- prevents double-submits (e.g. someone
// tapping "send" twice while the email is still going out) without any
// manual isSubmitting state in the form itself. Must be rendered inside the
// <form>, per useFormStatus's rule.
export function SubmitButton({
  children,
  pendingLabel,
  disabled = false,
  className = "rounded bg-accent px-3 py-2.5 font-medium text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending} className={className}>
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
