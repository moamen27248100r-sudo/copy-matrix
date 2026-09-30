import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { sendAnnouncement, deleteAnnouncement } from "@/app/lead/announcements/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDateTime } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadAnnouncementsTitle"), description: t("leadAnnouncementsDesc") };
}

export default async function LeadAnnouncementsPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const { err, ok } = await searchParams;
  const t = await getTranslations("LeadTrader.announcements");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead%2Fannouncements");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: rows }, { count }] = await Promise.all([
    supabase.from("lead_trader_announcements").select("id, body, created_at").eq("provider_id", providerId).order("created_at", { ascending: false }).limit(50),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("provider_id", providerId).eq("is_active", true),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">{t("title")}</h1>
      {err && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{t(err === "empty" ? "err_empty" : "err_failed")}</p>}
      {ok && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{t("sent")}</p>}

      <form action={sendAnnouncement} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
        <textarea name="body" rows={3} maxLength={280} required placeholder={t("placeholder")} className="rounded-lg border border-border bg-background px-3 py-2 text-base" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{t("audience", { count: count ?? 0 })}</p>
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            {t("send")}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-section-title">{t("history")}</h2>
        {(rows ?? []).length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}
        {(rows ?? []).map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="min-w-0">
              <p className="whitespace-pre-line break-words text-sm">{a.body}</p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(a.created_at, locale)}</p>
            </div>
            <form action={deleteAnnouncement}>
              <input type="hidden" name="id" value={a.id} />
              <ConfirmButton confirmText={t("deleteConfirm")} className="shrink-0 text-xs text-danger hover:underline">
                {t("delete")}
              </ConfirmButton>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
