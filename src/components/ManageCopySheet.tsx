"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

// "Manage copy": a small button next to the leader's name that opens a bottom sheet holding the
// actions for a copy that is running (edit its settings, stop it). The actions are passed in as
// children, so the sheet itself knows nothing about copying.
export function ManageCopySheet({
  label,
  title,
  closeLabel,
  children,
}: {
  label: string;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useBodyScrollLock(open);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="tap-44 rounded-full border border-border px-3 py-0.5 text-xs font-medium transition hover:border-accent/50"
      >
        {label}
      </button>
      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[10020] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl border border-border bg-[#0B132B] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[20px]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-section-title">{title}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={closeLabel}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-col gap-3 [&>*]:w-full [&_button]:w-full">{children}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
