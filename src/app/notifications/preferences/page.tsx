import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";

const CATEGORIES = ["trades", "copy", "account", "security"] as const;
const CHANNELS = ["inApp", "email", "telegram"] as const;

// UI only for now: delivery preferences need a stored table plus email /
// Telegram senders, which don't exist yet.
export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("notificationPreferencesTitle"), description: t("notificationPreferencesDesc") };
}

export default async function NotificationPreferencesPage() {
  const t = await getTranslations("Notifications");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fnotifications%2Fpreferences");

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6 pb-24 lg:ms-64 lg:me-0 lg:pb-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-page-title">{t("prefsTitle")}</h1>
          <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            {t("comingSoon")}
          </span>
        </div>
        <p className="text-sm text-muted">{t("prefsDesc")}</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 text-start font-normal" />
                {CHANNELS.map((c) => (
                  <th key={c} className="px-3 py-2 text-center font-normal">
                    {t(`channel_${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3 font-medium">{t(`cat_${cat}`)}</td>
                  {CHANNELS.map((c) => (
                    <td key={c} className="px-3 py-3 text-center">
                      <input type="checkbox" disabled defaultChecked={c === "inApp"} aria-label={`${t(`cat_${cat}`)} ${t(`channel_${c}`)}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href="/notifications" className="text-sm text-accent hover:underline">
          {t("backToNotifications")}
        </Link>
      </main>
    </>
  );
}
