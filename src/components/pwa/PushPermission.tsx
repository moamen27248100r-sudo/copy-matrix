"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BellRing } from "lucide-react";
import { removePushSubscription, savePushSubscription } from "@/app/notifications/push-actions";

// Phone / desktop notifications (Web Push). The permission is asked only when the customer presses
// the button, after the reason is explained. The same events, limits and per-category settings as
// the in-app notifications apply (the database pushes only what it delivered in the app).

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "unconfigured" | "denied" | "off" | "on";

export function PushPermission({ publicKey }: { publicKey: string }) {
  const t = useTranslations("Pwa");
  const locale = useLocale();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next: State;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = "unsupported";
      else if (!publicKey) next = "unconfigured";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
        const sub = await reg?.pushManager.getSubscription().catch(() => null);
        next = sub && Notification.permission === "granted" ? "on" : "off";
      }
      if (alive) setState(next);
    })();
    return () => {
      alive = false;
    };
  }, [publicKey]);

  async function enable() {
    setBusy(true);
    setFailed(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const json = sub.toJSON();
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        locale,
      });
      if (!res.ok) throw new Error("save");
      setState("on");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unconfigured" || state === "unsupported") return null;

  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <BellRing className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-section-title">{t("pushTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("pushBody")}</p>
        </div>
      </div>
      {state === "denied" && <p className="text-xs text-warning">{t("pushDenied")}</p>}
      {failed && <p className="text-xs text-danger">{t("pushFailed")}</p>}
      {state === "off" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="tap-44 self-start rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-60"
        >
          {t("pushEnable")}
        </button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-success">{t("pushEnabled")}</span>
          <button type="button" onClick={disable} disabled={busy} className="text-xs text-muted underline hover:text-foreground disabled:opacity-60">
            {t("pushDisable")}
          </button>
        </div>
      )}
    </section>
  );
}
