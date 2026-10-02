import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Monitor, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { formatDateTime } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";
import { signOutOtherSessions } from "./actions";

type SessionRow = {
  id: string;
  created_at: string;
  last_active_at: string;
  user_agent: string | null;
  ip: string | null;
  is_current: boolean;
};

export async function generateMetadata() {
  const t = await getTranslations("AccountSecurityPage");
  return { title: t("devices") };
}

// Browser / OS names are proper nouns, so they aren't translated.
function describeAgent(ua: string | null): { label: string | null; mobile: boolean } {
  if (!ua) return { label: null, mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const label = [browser, os].filter(Boolean).join(" · ");
  return { label: label || null, mobile };
}

export default async function AccountSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { done, error } = await searchParams;
  const t = await getTranslations("AccountSessions");
  const ts = await getTranslations("AccountSecurityPage");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsessions");

  const { data } = await supabase.rpc("my_auth_sessions");
  const sessions = (data ?? []) as SessionRow[];
  const others = sessions.filter((s) => !s.is_current).length;

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{ts("devices")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>

        {done && <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">{t("signedOutOthers")}</p>}
        {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{t("signOutFailed")}</p>}

        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const { label, mobile } = describeAgent(s.user_agent);
            const Icon = mobile ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-foreground/70">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" dir="ltr">
                      {label ?? t("unknownDevice")}
                    </span>
                    {s.is_current && (
                      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                        {t("thisDevice")}
                      </span>
                    )}
                  </div>
                  {s.ip && (
                    <p className="text-xs text-muted" dir="ltr">
                      {s.ip}
                    </p>
                  )}
                  <p className="text-xs text-muted">{t("lastActive", { time: formatDateTime(s.last_active_at, locale) })}</p>
                  <p className="text-xs text-muted">{t("signedIn", { time: formatDateTime(s.created_at, locale) })}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {others > 0 ? (
          <form action={signOutOtherSessions}>
            <button
              type="submit"
              className="w-full rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger transition hover:bg-danger/20"
            >
              {t("signOutOthers")}
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">{t("noOthers")}</p>
        )}
      </main>
    </>
  );
}
