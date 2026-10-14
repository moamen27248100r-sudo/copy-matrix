"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

// One component for every transient message of the platform.
//   * success / info: a floating message that goes away by itself after ~4 seconds, with a close button;
//   * error: floating too, and it stays until it is closed.
// It never pushes the page content (it is fixed): at the top of the screen on a phone, in the corner
// on a desktop. Screen readers get it through a live region (errors are announced assertively).
// Field errors are NOT toasts: they stay under their field until fixed.

export type ToastTone = "success" | "info" | "error";
type ToastItem = { id: number; tone: ToastTone; content: ReactNode };

const DISMISS_AFTER_MS = 4000;

const ToastContext = createContext<{ show: (tone: ToastTone, content: ReactNode) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.show;
}

const TONES: Record<ToastTone, { box: string; icon: typeof Info }> = {
  success: { box: "border-success/40 bg-[#0f2a1f] text-success", icon: CheckCircle2 },
  info: { box: "border-accent/40 bg-[#0f1f3a] text-accent-text", icon: Info },
  error: { box: "border-danger/40 bg-[#2b1217] text-danger", icon: XCircle },
};

function ToastView({ item, onClose }: { item: ToastItem; onClose: (id: number) => void }) {
  const t = useTranslations("Common");
  const tone = TONES[item.tone];
  const Icon = tone.icon;

  useEffect(() => {
    if (item.tone === "error") return;
    const timer = setTimeout(() => onClose(item.id), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [item.id, item.tone, onClose]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur ${tone.box}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-foreground">{item.content}</div>
      <button
        type="button"
        onClick={() => onClose(item.id)}
        aria-label={t("dismiss")}
        className="-me-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-white/10 hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const close = useCallback((id: number) => setItems((list) => list.filter((i) => i.id !== id)), []);
  const show = useCallback((tone: ToastTone, content: ReactNode) => {
    const id = nextId.current++;
    // At most 3 at a time: the oldest goes first.
    setItems((list) => [...list.slice(-2), { id, tone, content }]);
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          // Phone: top of the screen, under the status bar. Desktop: bottom corner (end edge), clear of the sidebar.
          <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[10050] flex flex-col items-center gap-2 px-3 lg:inset-x-auto lg:bottom-6 lg:top-auto lg:end-6 lg:w-96 lg:items-stretch lg:px-0">
            {items.map((item) => (
              <ToastView key={item.id} item={item} onClose={close} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/**
 * A server-rendered page's one-shot message ("saved", "failed", ...): draws nothing in the page, it
 * raises a toast once when the page shows. The ?error / ?success parameter that carried it is
 * removed from the address afterwards (StripFlashParams), so a reload does not bring it back.
 */
export function FlashMessage({ tone, children }: { tone: ToastTone; children: ReactNode }) {
  const show = useToast();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    show(tone, children);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
