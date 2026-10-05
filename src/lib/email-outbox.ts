import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendMail } from "@/lib/email";
import { renderEmail, type OutboxRow } from "@/lib/email-render";

const MAX_ATTEMPTS = 3;

// Sends the queued emails (email_outbox, migration 0242). Without SMTP
// settings the queue is marked skipped instead of piling up, so adding the
// settings later doesn't flood customers with old messages.
export async function processEmailOutbox({ limit = 50, siteUrl }: { limit?: number; siteUrl: string }) {
  const admin = createAdminClient();
  // A notice that couldn't go out within a day is stale; it is dropped, not
  // sent late (e.g. everything queued before the dispatch was set up).
  await admin
    .from("email_outbox")
    .update({ status: "skipped", last_error: "expired" })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  // Handled rows are kept 30 days for support questions, then removed.
  await admin
    .from("email_outbox")
    .delete()
    .neq("status", "pending")
    .lt("created_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString());
  const { data: rows } = await admin
    .from("email_outbox")
    .select("id, user_id, kind, category, account_type, data, fallback_title, fallback_body, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!rows?.length) return { sent: 0, skipped: 0, failed: 0 };

  if (!emailConfigured()) {
    await admin
      .from("email_outbox")
      .update({ status: "skipped", last_error: "smtp_not_configured" })
      .in("id", rows.map((r) => r.id));
    return { sent: 0, skipped: rows.length, failed: 0 };
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await admin.from("profiles").select("id, email, display_name, locale").in("id", userIds);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    const profile = byId.get(row.user_id);
    if (!profile?.email) {
      await admin.from("email_outbox").update({ status: "skipped", last_error: "no_email" }).eq("id", row.id);
      skipped++;
      continue;
    }
    try {
      const { subject, html, text } = await renderEmail(row as OutboxRow, {
        locale: profile.locale,
        name: profile.display_name,
        siteUrl,
      });
      await sendMail({ to: profile.email, subject, html, text });
      await admin.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), attempts: row.attempts + 1 }).eq("id", row.id);
      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      await admin
        .from("email_outbox")
        .update({ status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts, last_error: String((err as Error).message).slice(0, 500) })
        .eq("id", row.id);
      failed++;
    }
  }
  return { sent, skipped, failed };
}
