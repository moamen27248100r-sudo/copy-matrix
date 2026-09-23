import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, markOneRead } from "@/app/notifications/actions";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";
import { renderNotification } from "@/lib/render-notification";
import { localeTag } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

function renderBody(body: string) {
  const match = body.match(/^(.*?)([+-]\d[\d,]*\.?\d*)(\$|%)$/);
  if (!match) return body;
  const [, prefix, amount, unit] = match;
  const isPositive = !amount.startsWith("-");
  return (
    <>
      {prefix}
      <span className={isPositive ? "text-success" : "text-danger"}>
        {amount}
        {unit}
      </span>
    </>
  );
}

const ICONS = {
  copy_opened: (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  ),
  copy_closed: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  auto_stop_copy: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  followed_trade_closed: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  wallet_deposit_approved: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12 12 16 16 12" />
      <line x1="12" y1="8" x2="12" y2="16" />
    </>
  ),
  wallet_withdrawal_approved: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" y1="16" x2="12" y2="8" />
    </>
  ),
  kyc_approved: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <polyline points="9 12 11 14 15 10" />
    </>
  ),
  default: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
} as const;

const ICON_TONE: Record<string, string> = {
  copy_opened: "bg-accent/10 text-accent",
  copy_closed: "bg-foreground/10 text-foreground",
  auto_stop_copy: "bg-danger/10 text-danger",
  followed_trade_closed: "bg-accent/10 text-accent",
  wallet_deposit_approved: "bg-success/10 text-success",
  wallet_withdrawal_approved: "bg-foreground/10 text-foreground",
  kyc_approved: "bg-success/10 text-success",
};

function NotificationIcon({ type }: { type: string }) {
  const path = ICONS[type as keyof typeof ICONS] ?? ICONS.default;
  const tone = ICON_TONE[type] ?? "bg-muted/10 text-muted";
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
      </svg>
    </div>
  );
}

function formatNotificationTime(iso: string, locale: Locale) {
  const d = new Date(iso);
  const tag = localeTag(locale);
  const date = d.toLocaleDateString(tag, { year: "numeric", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default async function NotificationsPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Nav");
  const tn = await getTranslations("Notifications");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
        <BackButton fallbackHref="/dashboard" />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t("notificationsTitle")}</h1>
          {hasUnread && (
            <form action={markAllRead}>
              <button type="submit" className="text-sm text-muted underline">
                {t("markAllRead")}
              </button>
            </form>
          )}
        </div>

        {(notifications ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t("notificationsEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications!.map((n) => {
              const { title, body } = renderNotification(tn, n);
              return (
                <form key={n.id} action={markOneRead}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    disabled={n.is_read}
                    className={
                      n.is_read
                        ? "relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface p-3.5 text-right"
                        : "relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-accent/30 bg-accent/5 p-3.5 text-right"
                    }
                  >
                    {!n.is_read && <span className="absolute inset-y-0 right-0 w-1 bg-accent" aria-hidden="true" />}
                    <NotificationIcon type={n.type} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{title}</p>
                        {!n.is_read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                      </div>
                      {body && <p className="whitespace-pre-line text-xs text-muted">{renderBody(body)}</p>}
                      <p className="mt-1 text-[11px] text-muted/70" dir="ltr">
                        {formatNotificationTime(n.created_at, locale)}
                      </p>
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
