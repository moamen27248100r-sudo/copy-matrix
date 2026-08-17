"use client";

import Link from "next/link";
import { markOneRead } from "@/app/notifications/actions";
import { useNavDrawer } from "@/components/nav-drawer-context";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

function renderBody(body: string) {
  const match = body.match(/^(.*?)([+-]\d[\d,]*\.?\d*)\$$/);
  if (!match) return body;
  const [, prefix, amount] = match;
  const isPositive = !amount.startsWith("-");
  return (
    <>
      {prefix}
      <span className={isPositive ? "text-success" : "text-danger"}>{amount}$</span>
    </>
  );
}

export function NotificationsMenu({ notifications }: { notifications: NotificationRow[] }) {
  const { open, toggle, close } = useNavDrawer("notifications");
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const preview = notifications.slice(0, 6);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label="الإشعارات"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border text-foreground"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <div
        className={
          open
            ? "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/50 transition-opacity duration-300 sm:top-16"
            : "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/50 opacity-0 pointer-events-none transition-opacity duration-300 sm:top-16"
        }
        onClick={close}
        aria-hidden="true"
      />
      <div
        className={
          open
            ? "fixed top-14 bottom-0 left-0 z-40 flex w-[65%] max-w-xs -translate-x-0 flex-col overflow-y-auto bg-surface shadow-xl transition-transform duration-300 ease-out sm:top-16"
            : "fixed top-14 bottom-0 left-0 z-40 flex w-[65%] max-w-xs -translate-x-full flex-col overflow-y-auto bg-surface shadow-xl transition-transform duration-300 ease-out sm:top-16"
        }
      >
        <div className="border-b border-border px-4 py-3">
          <span className="text-sm font-medium">الإشعارات</span>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
          {preview.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted">لا توجد إشعارات حتى الآن.</p>
          ) : (
            preview.map((n) => (
              <form key={n.id} action={markOneRead}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  type="submit"
                  disabled={n.is_read}
                  className={
                    n.is_read
                      ? "flex w-full flex-col gap-1 rounded-lg border border-border bg-background p-3 text-start"
                      : "flex w-full flex-col gap-1 rounded-lg border border-brand/40 bg-brand/5 p-3 text-start"
                  }
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted">{renderBody(n.body)}</p>}
                </button>
              </form>
            ))
          )}
        </div>

        <div className="border-t border-border p-3">
          <Link
            href="/notifications"
            onClick={close}
            className="flex w-full items-center justify-center rounded border border-border px-3 py-2 text-sm text-foreground hover:bg-background"
          >
            عرض الكل
          </Link>
        </div>
      </div>
    </>
  );
}
