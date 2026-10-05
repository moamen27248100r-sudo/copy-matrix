import { createTranslator } from "next-intl";
import { isRtlLocale, isSupportedLocale, DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { formatMoney } from "@/lib/money";
import { renderNotification } from "@/lib/render-notification";

// Renders a queued email (email_outbox) in the customer's language: the same
// title / body as the in-app notification, inside a branded, table-based
// layout that holds up in every mail client, with a button to the right page.

export type OutboxRow = {
  kind: string;
  category: string;
  account_type: string | null;
  data: Record<string, unknown> | null;
  fallback_title: string | null;
  fallback_body: string | null;
};

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

// Which page the email's button opens.
function target(kind: string): { path: string; cta: string } {
  if (kind === "copy_opened" || kind === "copy_closed" || kind === "auto_stop_copy") return { path: "/trades", cta: "ctaTrades" };
  if (kind.startsWith("wallet_")) return { path: "/portfolio/history", cta: "ctaWallet" };
  if (kind.startsWith("kyc_")) return { path: "/kyc", cta: "ctaKyc" };
  if (kind.startsWith("lead_")) return { path: "/lead", cta: "ctaLead" };
  if (kind.startsWith("security_")) return { path: "/account/security", cta: "ctaSecurity" };
  return { path: "/notifications", cta: "ctaNotifications" };
}

const SECURITY_KEYS: Record<string, [string, string]> = {
  security_password_changed: ["passwordChangedTitle", "passwordChangedBody"],
  security_mfa_changed: ["mfaChangedTitle", "mfaChangedBody"],
  security_withdrawal_requested: ["withdrawalRequestedTitle", "withdrawalRequestedBody"],
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function renderEmail(row: OutboxRow, opts: { locale: string | null; name: string | null; siteUrl: string }) {
  const locale: Locale = isSupportedLocale(opts.locale ?? undefined) ? (opts.locale as Locale) : DEFAULT_LOCALE;
  const messages = await loadMessages(locale);
  // Messages are loaded at runtime, so the translators are typed loosely.
  const te = createTranslator({ locale, messages, namespace: "Email" }) as unknown as Translate;
  const tn = createTranslator({ locale, messages, namespace: "Notifications" }) as unknown as Translate;
  const money = (v: number, o?: { signed?: boolean }) => formatMoney(v, locale, o);
  const data = row.data ?? {};

  let title: string;
  let body: string | null;
  const security = SECURITY_KEYS[row.kind];
  if (security) {
    title = te(security[0]);
    body = te(security[1], {
      amount: money(Number(data.amount ?? 0)),
      network: String(data.network ?? ""),
      address: String(data.address ?? ""),
    });
  } else {
    ({ title, body } = renderNotification(
      tn,
      { type: row.kind, title: row.fallback_title ?? "", body: row.fallback_body, data: row.data },
      money,
    ));
  }

  const { path, cta } = target(row.kind);
  const url = `${opts.siteUrl.replace(/\/$/, "")}${path}`;
  const prefsUrl = `${opts.siteUrl.replace(/\/$/, "")}/notifications/preferences`;
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const align = dir === "rtl" ? "right" : "left";
  const greeting = opts.name ? te("greetingName", { name: opts.name }) : te("greeting");
  const account = row.account_type === "real" ? te("accountReal") : row.account_type === "demo" ? te("accountDemo") : null;
  const securityNote = row.category === "security" && row.kind.startsWith("security_") ? te("notYou") : null;
  const footer = row.category === "security" ? te("footerSecurity") : te("footerPrefs");

  const p = (text: string, style: string) => `<p style="margin:0 0 12px;${style}">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f2f4f8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f8;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;color:#1a2234;" dir="${dir}">
<tr><td style="background:#0b0f17;padding:18px 24px;text-align:${align};">
<span style="font-size:18px;font-weight:700;color:#ffffff;">Copy Matrix</span>
${account ? `<span style="display:inline-block;margin-${dir === "rtl" ? "right" : "left"}:10px;padding:2px 10px;border-radius:999px;font-size:12px;background:${row.account_type === "real" ? "#0ecb81" : "#f0b90b"};color:#0b0f17;">${escapeHtml(account)}</span>` : ""}
</td></tr>
<tr><td style="padding:28px 24px 8px;text-align:${align};">
${p(greeting, "font-size:14px;color:#5b6475;")}
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;color:#1a2234;">${escapeHtml(title)}</h1>
${body ? p(body, "font-size:15px;line-height:1.7;color:#2b3446;") : ""}
${securityNote ? p(securityNote, "font-size:13px;line-height:1.6;color:#b4232f;background:#fdecee;border-radius:8px;padding:10px 12px;") : ""}
</td></tr>
<tr><td style="padding:8px 24px 28px;text-align:${align};">
<a href="${url}" style="display:inline-block;background:#2f6fed;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">${escapeHtml(te(cta))}</a>
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e6e9f0;text-align:${align};font-size:12px;line-height:1.6;color:#7a8396;">
${escapeHtml(footer)}${row.category === "security" ? "" : ` <a href="${prefsUrl}" style="color:#2f6fed;">${escapeHtml(te("managePrefs"))}</a>`}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [greeting, "", title, body ?? "", securityNote ?? "", "", `${te(cta)}: ${url}`, "", footer].filter((l) => l !== null).join("\n");
  return { subject: `${title} | Copy Matrix`, html, text };
}
