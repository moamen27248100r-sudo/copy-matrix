import { getMoney } from "@/lib/money-server";
import { AppMain } from "@/components/AppMain";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getUserTimeZone } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, markOneRead } from "@/app/notifications/actions";
import { AppNav } from "@/components/AppNav";
import { LinkTabs } from "@/components/LinkTabs";
import { Settings } from "lucide-react";
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
        {unit === "$" ? `${amount.slice(0, 1)}$${amount.slice(1)}` : `${amount}${unit}`}
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
  market_move: (
    <>
      <polyline points="3 17 9 11 13 15 21 7" />
      <polyline points="15 7 21 7 21 13" />
    </>
  ),
  copy_daily_summary: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 15v-3M12 15V9M16 15v-5" />
    </>
  ),
  market_price_alert: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
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
  copy_reduced: "bg-warning/10 text-warning",
  copy_skipped: "bg-danger/10 text-danger",
  copy_closed: "bg-foreground/10 text-foreground",
  auto_stop_copy: "bg-danger/10 text-danger",
  followed_trade_closed: "bg-accent/10 text-accent",
  wallet_deposit_approved: "bg-success/10 text-success",
  wallet_withdrawal_approved: "bg-foreground/10 text-foreground",
  kyc_approved: "bg-success/10 text-success",
  market_move: "bg-warning/10 text-warning",
  market_price_alert: "bg-accent/10 text-accent",
  copy_daily_summary: "bg-accent/10 text-accent",
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

// Read once per request (kept out of the render body).
function requestNow() {
  return new Date();
}

// Day buckets in the customer's time zone, like the activity lists of the big apps.
type DayGroup = "today" | "yesterday" | "week" | "earlier";
function dayGroup(iso: string, timeZone: string, now: Date): DayGroup {
  // y-m-d of the day in that zone (from the parts, so no display language is involved)
  const fmt = new Intl.DateTimeFormat(undefined, { timeZone, year: "numeric", month: "numeric", day: "numeric", numberingSystem: "latn" });
  const key = (d: Date) => {
    const part = (type: string) => Number(fmt.formatToParts(d).find((x) => x.type === type)?.value ?? 0);
    return Date.UTC(part("year"), part("month") - 1, part("day"));
  };
  const days = Math.round((key(now) - key(new Date(iso))) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? "week" : "earlier";
}
const isZeroClose = (n: { type: string; data: Record<string, unknown> | null }) =>
  n.type === "copy_closed" && n.data != null && Number(n.data.amount ?? NaN) === 0 && Number(n.data.count ?? 1) === 1;

function formatNotificationTime(iso: string, locale: Locale, timeZone: string) {
  const d = new Date(iso);
  const tag = localeTag(locale);
  const date = d.toLocaleDateString(tag, { year: "numeric", month: "short", day: "numeric", timeZone });
  const time = d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit", timeZone });
  return `${date} · ${time}`;
}

// Four tabs: everything, copying (copies, followed traders, loss alerts), the account (money, identity,
// security) and the market (big moves of an instrument, important news).
const CATEGORY_TYPES: Record<string, string[]> = {
  copy: [
    "followed_trade_opened",
    "followed_trade_closed",
    "copy_started",
    "copy_stopped",
    "copy_opened",
    "copy_closed",
    "copy_reduced",
    "copy_skipped",
    "auto_stop_copy",
    "loss_alert",
    "leader_stopped",
    "copy_daily_summary",
  ],
  market: ["market_move", "market_price_alert", "market_news"],
};
const CATEGORY_KEYS = ["all", "copy", "account", "market"] as const;

function categoryOf(type: string): string {
  for (const [cat, types] of Object.entries(CATEGORY_TYPES)) if (types.includes(type)) return cat;
  return "account";
}

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("notificationsTitle"), description: t("notificationsDesc") };
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const activeCat = (CATEGORY_KEYS as readonly string[]).includes(cat ?? "") ? (cat as string) : "all";
  const locale = (await getLocale()) as Locale;
  const userTz = await getUserTimeZone();
  const money = await getMoney();
  const t = await getTranslations("Nav");
  const tn = await getTranslations("Notifications");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fnotifications");

  // The current account's notifications plus the shared account / security
  // ones (0241), like the separate demo and real modes of trading platforms.
  const { data: notifications } = await supabase.rpc("my_notifications", { p_limit: 50 });

  const rows = (notifications ?? []) as { id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; is_read: boolean; created_at: string }[];
  const hasUnread = rows.some((n) => !n.is_read);
  const visible = rows.filter((n) => activeCat === "all" || categoryOf(n.type) === activeCat);
  const now = requestNow();
  const groups = (["today", "yesterday", "week", "earlier"] as DayGroup[])
    .map((g) => {
      const items = visible.filter((n) => dayGroup(n.created_at, userTz, now) === g);
      return { g, items: items.filter((n) => !isZeroClose(n)), zero: items.filter(isZeroClose) };
    })
    .filter((x) => x.items.length + x.zero.length > 0);

  return (
    <>
      <AppNav />
      <AppMain>
        <div className="flex items-center justify-between">
          <h1 className="text-page-title">{t("notificationsTitle")}</h1>
          {hasUnread && (
            <form action={markAllRead}>
              <button type="submit" className="text-sm text-muted underline">
                {t("markAllRead")}
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <LinkTabs
              active={activeCat}
              items={CATEGORY_KEYS.map((k) => ({
                key: k,
                href: k === "all" ? "/notifications" : `/notifications?cat=${k}`,
                label: tn(`cat_${k}`),
              }))}
            />
          </div>
          <Link
            href="/notifications/preferences"
            aria-label={tn("prefsLink")}
            title={tn("prefsLink")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:text-foreground"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-muted">{t("notificationsEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(({ g, items, zero }) => (
            <section key={g} className="flex flex-col gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{tn(`group_${g}`)}</h2>
            {zero.length > 0 && (
              <p className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 text-xs text-muted">
                <NotificationIcon type="copy_closed" />
                {tn("zeroClosedSummary", { count: zero.length })}
              </p>
            )}
            {items.map((n) => {
              const { title, body } = renderNotification(tn, n, money);
              return (
                <form key={n.id} action={markOneRead}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    disabled={n.is_read}
                    className={
                      n.is_read
                        ? "relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface p-3.5 text-start"
                        : "relative flex w-full items-start gap-3 overflow-hidden rounded-lg border border-accent/30 bg-accent/5 p-3.5 text-start"
                    }
                  >
                    {!n.is_read && <span className="absolute inset-y-0 start-0 w-1 bg-accent" aria-hidden="true" />}
                    <NotificationIcon type={n.type} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium" dir="auto">{title}</p>
                        {!n.is_read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                      </div>
                      {body && <p className="whitespace-pre-line text-xs text-muted" dir="auto">{renderBody(body)}</p>}
                      <p className="mt-1 text-xs text-dim" dir="ltr">
                        {formatNotificationTime(n.created_at, locale, userTz)}
                      </p>
                    </div>
                  </button>
                </form>
              );
            })}
            </section>
            ))}
          </div>
        )}
      </AppMain>
    </>
  );
}
