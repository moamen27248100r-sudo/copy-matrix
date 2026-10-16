import webpush from "web-push";
import { createTranslator } from "next-intl";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/i18n/locales";
import { formatMoney } from "@/lib/money";
import { renderNotification } from "@/lib/render-notification";

// Web Push delivery of the notifications queued in push_outbox (migration 0260).
// It works only when the VAPID keys are in the environment:
//   VAPID_PUBLIC_KEY (or NEXT_PUBLIC_VAPID_PUBLIC_KEY), VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https:)
// Without them nothing is sent and nothing fails: the queue is simply left alone.

const MAX_ATTEMPTS = 3;

export function pushConfigured() {
  return !!(vapidPublic() && process.env.VAPID_PRIVATE_KEY);
}
export function vapidPublic() {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
}

type Messages = Record<string, Record<string, unknown>>;
type Translate = (key: string, values?: Record<string, string | number>) => string;
const messagesCache = new Map<Locale, Messages>();
async function loadMessages(locale: Locale): Promise<Messages> {
  let m = messagesCache.get(locale);
  if (!m) {
    m = (await import(`@/messages/${locale}.json`)).default as Messages;
    messagesCache.set(locale, m);
  }
  return m;
}

// The page a tap on the notification opens.
function targetPath(type: string, data: Record<string, unknown>): string {
  if ((type === "market_move" || type === "market_price_alert") && typeof data.symbol === "string") return `/markets/${data.symbol}`;
  if (["loss_alert", "copy_started", "copy_stopped", "leader_stopped", "copy_reduced", "copy_skipped", "copy_daily_summary"].includes(type)) return "/copies";
  if (["copy_opened", "copy_closed", "auto_stop_copy"].includes(type)) return "/trades";
  if (type.startsWith("wallet_")) return "/portfolio";
  if (type.startsWith("kyc_")) return "/kyc";
  if (type.startsWith("security_")) return "/account/security";
  return "/notifications";
}

export async function processPushOutbox({ limit = 100 }: { limit?: number } = {}) {
  if (!pushConfigured()) return { configured: false, sent: 0, failed: 0, removed: 0 };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@copy-matrix.com", vapidPublic(), process.env.VAPID_PRIVATE_KEY as string);

  const admin = createAdminClient();
  // A notice that could not go out within a day is stale: dropped, not sent late.
  await admin
    .from("push_outbox")
    .update({ status: "skipped", error: "expired" })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  const { data: rows } = await admin
    .from("push_outbox")
    .select("id, user_id, type, data, fallback_title, fallback_body, attempts")
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(limit);
  if (!rows?.length) return { configured: true, sent: 0, failed: 0, removed: 0 };

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: subs }, { data: profiles }] = await Promise.all([
    admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth, locale").in("user_id", userIds),
    admin.from("profiles").select("id, locale").in("id", userIds),
  ]);
  const subsByUser = new Map<string, NonNullable<typeof subs>>();
  for (const s of subs ?? []) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s]);
  const localeByUser = new Map((profiles ?? []).map((p) => [p.id, p.locale as string | null]));

  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const row of rows) {
    const devices = subsByUser.get(row.user_id) ?? [];
    if (devices.length === 0) {
      await admin.from("push_outbox").update({ status: "skipped", error: "no_device" }).eq("id", row.id);
      continue;
    }
    const raw = localeByUser.get(row.user_id) ?? devices[0].locale ?? undefined;
    const locale: Locale = isSupportedLocale(raw ?? undefined) ? (raw as Locale) : DEFAULT_LOCALE;
    const messages = await loadMessages(locale);
    const tn = createTranslator({ locale, messages, namespace: "Notifications" }) as unknown as Translate;
    const money = (v: number, o?: { signed?: boolean }) => formatMoney(v, locale, o);
    const data = (row.data ?? {}) as Record<string, unknown>;
    const { title, body } = renderNotification(tn, { type: row.type, title: row.fallback_title ?? "", body: row.fallback_body, data: row.data }, money);
    const payload = JSON.stringify({
      title: title || "Copy Matrix",
      body: body ?? "",
      url: targetPath(row.type, data),
      tag: row.type,
    });

    let delivered = 0;
    let lastError = "";
    for (const d of devices) {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 3600 });
        delivered++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        lastError = String((err as Error).message).slice(0, 300);
        // The device is gone (uninstalled / permission withdrawn): forget it.
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("id", d.id);
          removed++;
        }
      }
    }
    if (delivered > 0) {
      await admin.from("push_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 }).eq("id", row.id);
      sent++;
    } else {
      const attempts = row.attempts + 1;
      await admin
        .from("push_outbox")
        .update({ status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts, error: lastError || "no_delivery" })
        .eq("id", row.id);
      failed++;
    }
  }
  return { configured: true, sent, failed, removed };
}
