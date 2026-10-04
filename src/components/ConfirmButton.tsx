"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmButton({
  confirmText,
  className,
  children,
}: {
  confirmText: string;
  className?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
