"use client";

import { useRef, useState } from "react";
import { chooseAccountType } from "@/app/auth/actions";

type AccountType = "real" | "demo";

const VARIANT_CLASSES = {
  card: {
    group: "flex gap-1 rounded-lg border border-border bg-background p-0.5 text-xs",
    active: "rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground",
    inactive: "rounded-md px-3 py-1.5 font-medium text-muted transition hover:text-foreground",
  },
  pill: {
    group: "flex rounded-full bg-black/25 p-1",
    active: "flex-1 rounded-full bg-white/10 px-3 py-1.5 text-center text-xs font-semibold text-foreground",
    inactive: "flex-1 rounded-full px-3 py-1.5 text-center text-xs font-semibold text-muted transition hover:text-foreground",
  },
};

export function AccountTypeSwitcher({
  accountType,
  next,
  ariaLabel,
  options,
  confirmTitle,
  confirmText,
  confirmCta,
  cancelCta,
  variant = "card",
  onSwitch,
}: {
  accountType: AccountType;
  next: string;
  ariaLabel: string;
  options: { key: AccountType; label: string }[];
  confirmTitle: string;
  confirmText: string;
  confirmCta: string;
  cancelCta: string;
  variant?: "card" | "pill";
  onSwitch?: () => void;
}) {
  const [pending, setPending] = useState<AccountType | null>(null);
  const realFormRef = useRef<HTMLFormElement>(null);
  const demoFormRef = useRef<HTMLFormElement>(null);
  const formRefs: Record<AccountType, React.RefObject<HTMLFormElement | null>> = {
    real: realFormRef,
    demo: demoFormRef,
  };
  const cls = VARIANT_CLASSES[variant];

  return (
    <>
      <form ref={realFormRef} action={chooseAccountType} className="hidden">
        <input type="hidden" name="accountType" value="real" />
        <input type="hidden" name="next" value={next} />
      </form>
      <form ref={demoFormRef} action={chooseAccountType} className="hidden">
        <input type="hidden" name="accountType" value="demo" />
        <input type="hidden" name="next" value={next} />
      </form>

      <div className={cls.group} role="group" aria-label={ariaLabel}>
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => opt.key !== accountType && setPending(opt.key)}
            className={opt.key === accountType ? cls.active : cls.inactive}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground">{confirmTitle}</h3>
            <p className="mt-2 text-sm text-muted">{confirmText}</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:border-accent/50"
              >
                {cancelCta}
              </button>
              <button
                type="button"
                onClick={() => {
                  formRefs[pending].current?.requestSubmit();
                  setPending(null);
                  onSwitch?.();
                }}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
              >
                {confirmCta}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
