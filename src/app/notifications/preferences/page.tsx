import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { AutoDismissMessage } from "@/components/AutoDismissMessage";
import { saveNotificationPreferences } from "@/app/notifications/actions";

const CATEGORIES = ["trades", "copy", "account"] as const;

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("notificationPreferencesTitle"), description: t("notificationPreferencesDesc") };
}

export default async function NotificationPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const t = await getTranslations("Notifications");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fnotifications%2Fpreferences");

  const { data: prefs } = await supabase.from("notification_preferences").select("category, in_app").eq("user_id", user.id);
  const enabled = new Map((prefs ?? []).map((p) => [p.category as string, p.in_app as boolean]));

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("prefsTitle")}</h1>
        <p className="text-sm text-muted">{t("prefsDesc")}</p>

        {saved && (
          <AutoDismissMessage
            className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            clearParams={["saved"]}
          >
            {t("prefsSaved")}
          </AutoDismissMessage>
        )}
        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{t("prefsSaveFailed")}</p>
        )}

        <form action={saveNotificationPreferences} className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {CATEGORIES.map((cat) => (
              <label key={cat} className="flex cursor-pointer items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm">
                <span className="font-medium">{t(`cat_${cat}`)}</span>
                <input type="checkbox" name={`cat_${cat}`} defaultChecked={enabled.get(cat) ?? true} className="h-4 w-4 accent-accent" />
              </label>
            ))}
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium">{t("cat_security")}</span>
              <span className="text-xs text-muted">{t("prefsSecurityAlways")}</span>
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
          >
            {t("prefsSave")}
          </button>
        </form>

        <Link href="/notifications" className="text-sm text-accent hover:underline">
          {t("backToNotifications")}
        </Link>
      </main>
    </>
  );
}
