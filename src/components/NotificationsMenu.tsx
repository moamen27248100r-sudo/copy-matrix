"use client";

import { useMoney } from "@/lib/money-client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { markOneRead } from "@/app/notifications/actions";
import { useNavDrawer } from "@/components/nav-drawer-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { renderNotification } from "@/lib/render-notification";
import { notificationKind, relativeTime, type NotificationKind } from "@/lib/notification-meta";
import { X, Bell, ShieldCheck, BadgeCheck, Wallet, Copy, TrendingUp, Star, TriangleAlert, Eye } from "lucide-react";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};


function renderBody(body: string) {
  const match = body.match(/^(.*?)([+-]\d[\d,]*\.?\d*)(\$|%)$/);
  if (!match) return body;
  const [, prefix, amount, unit] = match;
  const isPositive = !amount.startsWith("-");
  return (
    <>
      {prefix}
      <span className={isPositive ? "text-success" : "text-danger"}>
        {unit === "$" ? `${amount.slice(0, 1)}$${amount.slice(1)}` : `${amount}${unit}`}
      </span>
    </>
  );
}

const ICONS: Record<NotificationKind, typeof Bell> = {
  copy: Copy,
  market: TrendingUp,
  security: ShieldCheck,
  verify: BadgeCheck,
  wallet: Wallet,
  leader: Star,
  alert: TriangleAlert,
  follow: Eye,
  other: Bell,
};

export function NotificationsMenu({ notifications, unreadCount }: { notifications: NotificationRow[]; unreadCount: number }) {
  const t = useTranslations("Nav");
  const tn = useTranslations("Notifications");
  const locale = useLocale();
  const money = useMoney();
  const { open, toggle, close } = useNavDrawer("notifications");
  const preview = notifications.slice(0, 20);
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (open && panelRef.current) panelRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `${t("notificationsAriaLabel")} ${unreadCount > 9 ? "9+" : unreadCount}` : t("notificationsAriaLabel")}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border text-foreground"
      >
        {open ? <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" /> : <Bell className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
        {!open && unreadCount > 0 && (
          <span dir="ltr" className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c9283e] px-1 text-xs font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Full width, from under the top bar to the bottom of the screen; the top bar stays and the same button closes it. */}
      <div
        ref={panelRef}
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-x-0 top-14 bottom-0 z-10 flex flex-col overflow-y-auto overscroll-contain bg-surface transition-opacity duration-200 sm:top-16 lg:start-[var(--sidebar-w)] ${
          open ? "opacity-100" : "pointer-events-none invisible opacity-0"
        }`}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <h2 className="px-4 pb-1 pt-4 text-base font-bold">{t("notificationsTitle")}</h2>

          <div className="flex flex-1 flex-col gap-2 p-3">
            {preview.length === 0 ? (
              <p className="p-3 text-center text-sm text-muted">{t("notificationsEmpty")}</p>
            ) : (
              preview.map((n) => {
                const { title, body } = renderNotification(tn, n, money);
                const Icon = ICONS[notificationKind(n.type)];
                return (
                  <form key={n.id} action={markOneRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      disabled={n.is_read}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start ${n.is_read ? "border-border bg-background" : "border-brand/40 bg-brand/5"}`}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-accent-text">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium" dir={n.data == null ? "auto" : undefined}>{title}</span>
                          <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-muted">
                            <time dateTime={n.created_at} suppressHydrationWarning>{relativeTime(n.created_at, locale)}</time>
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand" role="img" aria-label={tn("unreadDot")} />}
                          </span>
                        </span>
                        {body && <span className="whitespace-pre-line text-xs text-muted" dir={n.data == null ? "auto" : undefined}>{renderBody(body)}</span>}
                      </span>
                    </button>
                  </form>
                );
              })
            )}
          </div>

          <div className="border-t border-border p-3">
            <Link
              href="/notifications"
              onClick={close}
              className="flex w-full items-center justify-center rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-background"
            >
              {t("viewAll")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
