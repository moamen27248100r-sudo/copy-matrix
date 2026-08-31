import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MainMenu } from "@/components/MainMenu";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { NavDrawerProvider } from "@/components/nav-drawer-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/locales";

export async function AppNav() {
  const supabase = await createClient();
  const t = await getTranslations("Nav");
  const locale = (await getLocale()) as Locale;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let balance: number | null = null;
  let displayName: string | null = null;
  let email: string | null = null;
  let accountType: "real" | "demo" | null = null;
  let notifications: { id: string; title: string; body: string | null; is_read: boolean; created_at: string }[] = [];
  let activeCopyProviderId: string | null = null;
  if (user) {
    const [{ data: profile }, { data: notificationRows }, { data: activeSub }] = await Promise.all([
      supabase.from("profiles").select("is_admin, balance, is_suspended, display_name, email, account_type").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("subscriptions")
        .select("provider_id")
        .eq("follower_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);
    if (profile?.is_suspended) redirect("/suspended");
    isAdmin = !!profile?.is_admin;
    balance = profile?.balance ?? null;
    displayName = profile?.display_name ?? null;
    email = profile?.email ?? user.email ?? null;
    accountType = (profile?.account_type as "real" | "demo") ?? "demo";
    notifications = notificationRows ?? [];
    activeCopyProviderId = activeSub?.provider_id ?? null;
  }

  return (
    <nav className="sticky top-0 z-[9999] w-full border-b border-border bg-[#0b1726]">
      <NavDrawerProvider>
      <div className="mx-auto grid h-14 max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-0.5 px-1.5 sm:h-16 sm:gap-2 sm:px-6">
        <div className="flex min-w-0 justify-start">
          {user ? (
            <MainMenu
              balance={balance}
              isAdmin={isAdmin}
              displayName={displayName}
              email={email}
              accountType={accountType}
              activeCopyProviderId={activeCopyProviderId}
            />
          ) : (
            <Link
              href="/signup"
              className="min-w-0 whitespace-nowrap rounded bg-accent px-1.5 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover sm:px-3"
            >
              {t("createAccount")}
            </Link>
          )}
        </div>

        <Link href={user ? "/dashboard" : "/"} className="flex min-w-0 items-center justify-center overflow-hidden">
          <Logo iconClassName="h-5 w-5 sm:h-6 sm:w-6" textClassName="text-base sm:text-xl" />
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-3">
          {user ? (
            <NotificationsMenu notifications={notifications} />
          ) : (
            <>
              <LanguageSwitcher currentLocale={locale} />
              <Link
                href="/login"
                className="min-w-0 whitespace-nowrap rounded border border-border px-0.5 py-2 text-sm font-medium text-foreground transition hover:bg-surface sm:px-4"
              >
                {t("login")}
              </Link>
            </>
          )}
        </div>
      </div>
      </NavDrawerProvider>
    </nav>
  );
}
