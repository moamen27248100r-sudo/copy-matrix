"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Download, Share, SquarePlus, X } from "lucide-react";

// "Install the app": on Android the browser's own install dialog; on iPhone a two-step guide
// (Share -> Add to Home Screen), because iOS has no install prompt to trigger. Nothing is shown
// when the app already runs from the home screen. `variant="card"` is the dismissible suggestion
// (after the first copy); "button" is the always-available entry in the settings.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "cm.install.dismissed";
const DISMISS_FOR_MS = 14 * 24 * 3600_000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function InstallApp({ variant = "button" }: { variant?: "card" | "button" }) {
  const t = useTranslations("Pwa");
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStandalone(isStandalone());
      setIos(isIos());
      try {
        const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
        setDismissed(variant === "card" && at > 0 && Date.now() - at < DISMISS_FOR_MS);
      } catch {
        setDismissed(false);
      }
      setReady(true);
    }, 0);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, [variant]);

  if (!ready || standalone || dismissed) return null;
  // Not installable here (desktop Firefox, an in-app browser ...): say nothing.
  if (!event && !ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // not remembered
    }
    setDismissed(true);
  };
  const install = async () => {
    if (event) {
      await event.prompt();
      await event.userChoice.catch(() => null);
      setEvent(null);
    } else {
      setGuide(true);
    }
  };

  const button = (
    <button
      type="button"
      onClick={install}
      className="tap-44 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {t("installCta")}
    </button>
  );

  return (
    <>
      {variant === "card" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t("installTitle")}</p>
              <p className="mt-1 text-xs text-muted">{t("installBody")}</p>
            </div>
            <button type="button" onClick={dismiss} aria-label={t("later")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/10">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {button}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">{t("installBody")}</p>
          {button}
        </div>
      )}

      {guide &&
        createPortal(
          <div className="fixed inset-0 z-[10020] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setGuide(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("iosTitle")}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl border border-border bg-[#0B132B] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{t("iosTitle")}</h2>
                <button type="button" onClick={() => setGuide(false)} aria-label={t("later")} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-white/10">
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <ol className="flex flex-col gap-3 text-sm">
                <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Share className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>{t("iosStep1")}</span>
                </li>
                <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <SquarePlus className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>{t("iosStep2")}</span>
                </li>
              </ol>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
