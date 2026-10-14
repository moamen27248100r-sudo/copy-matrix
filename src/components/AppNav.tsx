import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MainMenu } from "@/components/MainMenu";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { GuestHeader } from "@/components/GuestHeader";
import { SidebarNav } from "@/components/SidebarNav";
import { NavDrawerProvider } from "@/components/nav-drawer-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/locales";

export async function AppNav({ sidebar = true }: { sidebar?: boolean } = {}) {
  const supabase = await createClient();
  const t = await getTranslations("Nav");
  const locale = (await getLocale()) as Locale;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A visitor gets the public header only: logo, language, log in, sign up.
  if (!user) return <GuestHeader />;

  let isAdmin = false;
  let displayName: string | null = null;
  let email: string | null = null;
  let accountType: "real" | "demo" | null = null;
  let isLeadTrader = false;
  let notifications: { id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; is_read: boolean; created_at: string }[] = [];
  let unreadCount = 0;
  let accountNumber: number | string = "";
  let kycStatus: string = "none";
  if (user) {
    const [{ data: profile }, { data: notificationRows }, { data: kyc }] = await Promise.all([
      supabase.from("profiles").select("is_admin, is_suspended, display_name, email, account_type, is_lead_trader, account_number").eq("id", user.id).single(),
      // Only the current account's notifications plus the shared ones (0241).
      supabase.rpc("my_notifications", { p_limit: 200 }),
      supabase
        .from("kyc_submissions")
        .select("status")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (profile?.is_suspended) redirect("/suspended");
    isAdmin = !!profile?.is_admin;
    displayName = profile?.display_name ?? null;
    email = profile?.email ?? user.email ?? null;
    accountType = (profile?.account_type as "real" | "demo") ?? "demo";
    isLeadTrader = !!profile?.is_lead_trader;
    accountNumber = profile?.account_number ?? "";
    const allNotifications = notificationRows ?? [];
    unreadCount = allNotifications.filter((n: { is_read: boolean }) => !n.is_read).length;
    notifications = allNotifications.slice(0, 10);
    kycStatus = kyc?.status ?? "none";
  }

  return (
    <>
    <nav className={`sticky top-0 z-[9999] w-full border-b border-border bg-[#0b1726] ${sidebar ? "lg:ps-[var(--sidebar-w)]" : ""}`}>
      <NavDrawerProvider>
      <div className="mx-auto grid h-14 max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-1 px-2 sm:h-16 sm:gap-2 sm:px-6">
        <div className="flex min-w-0 justify-start">
          {user ? (
            <MainMenu
              isAdmin={isAdmin}
              isLeadTrader={isLeadTrader}
              accountNumber={accountNumber}
              displayName={displayName}
              email={email}
              kycStatus={kycStatus}
              accountType={accountType ?? "demo"}
            />
          ) : (
            <Link
              href="/signup"
              className="tap-44 min-w-0 whitespace-nowrap rounded bg-accent px-2.5 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover sm:px-4"
            >
              {t("createAccount")}
            </Link>
          )}
        </div>

        <Link href={user ? "/dashboard" : "/"} className="flex min-h-11 min-w-0 items-center justify-center overflow-hidden">
          <Logo iconClassName="h-4 w-4 sm:h-5 sm:w-5" textClassName="text-base sm:text-xl" />
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-3">
          {user ? (
            <>
              <NotificationsMenu notifications={notifications} unreadCount={unreadCount} />
            </>
          ) : (
            <>
              <LanguageSwitcher currentLocale={locale} />
              <Link
                href="/login"
                className="tap-44 min-w-0 whitespace-nowrap rounded border border-border px-2 py-2 text-sm font-medium text-foreground transition hover:bg-surface sm:px-4"
              >
                {t("login")}
              </Link>
            </>
          )}
        </div>
      </div>
      </NavDrawerProvider>
    </nav>
    {user && sidebar && (
      <SidebarNav
        isAdmin={isAdmin}
        isLeadTrader={isLeadTrader}
        accountNumber={accountNumber}
        displayName={displayName}
        email={email}
        kycStatus={kycStatus}
        accountType={accountType ?? "demo"}
      />
    )}
    </>
  );
}
