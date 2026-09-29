import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MainMenu } from "@/components/MainMenu";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { AccountTypeSwitcher } from "@/components/AccountTypeSwitcher";
import { LeadModeSwitcher } from "@/components/LeadModeSwitcher";
import { SidebarNav } from "@/components/SidebarNav";
import { BottomNav } from "@/components/BottomNav";
import { NavDrawerProvider } from "@/components/nav-drawer-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/locales";

export async function AppNav() {
  const supabase = await createClient();
  const t = await getTranslations("Nav");
  const tKyc = await getTranslations("Kyc");
  const tDash = await getTranslations("Dashboard");
  const locale = (await getLocale()) as Locale;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let displayName: string | null = null;
  let email: string | null = null;
  let accountType: "real" | "demo" | null = null;
  let isLeadTrader = false;
  let notifications: { id: string; type: string; title: string; body: string | null; data: Record<string, unknown> | null; is_read: boolean; created_at: string }[] = [];
  let kycStatus: string = "none";
  if (user) {
    const [{ data: profile }, { data: notificationRows }, { data: kyc }] = await Promise.all([
      supabase.from("profiles").select("is_admin, is_suspended, display_name, email, account_type, is_lead_trader").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("id, type, title, body, data, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
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
    notifications = notificationRows ?? [];
    kycStatus = kyc?.status ?? "none";
  }

  return (
    <>
    <nav className="sticky top-0 z-[9999] w-full border-b border-border bg-[#0b1726]">
      <NavDrawerProvider>
      <div className="mx-auto grid h-14 max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-1 px-2 sm:h-16 sm:gap-2 sm:px-6">
        <div className="flex min-w-0 justify-start">
          {user ? (
            <MainMenu
              isAdmin={isAdmin}
              isLeadTrader={isLeadTrader}
              displayName={displayName}
              email={email}
              locale={locale}
              kycStatus={kycStatus}
              kycStatusLabels={{
                none: tKyc("statusNone"),
                pending: tKyc("statusPending"),
                approved: tKyc("statusApproved"),
                rejected: tKyc("statusRejected"),
              }}
            />
          ) : (
            <Link
              href="/signup"
              className="min-w-0 whitespace-nowrap rounded bg-accent px-2.5 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover sm:px-4"
            >
              {t("createAccount")}
            </Link>
          )}
        </div>

        <Link href={user ? "/dashboard" : "/"} className="flex min-w-0 items-center justify-center overflow-hidden">
          <Logo iconClassName="h-4 w-4 sm:h-5 sm:w-5" textClassName="text-base sm:text-xl" />
        </Link>

        <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-3">
          {user ? (
            <>
              {isLeadTrader && <LeadModeSwitcher />}
              {accountType && (
                <AccountTypeSwitcher
                  accountType={accountType}
                  next="/dashboard"
                  variant="card"
                  ariaLabel={t("switchAccountAriaLabel")}
                  options={[
                    { key: "real", label: tDash("accountTypeShortReal") },
                    { key: "demo", label: tDash("accountTypeShortDemo") },
                  ]}
                  confirmTitle={t("switchAccountConfirmTitle")}
                  confirmText={t("switchAccountWarning")}
                  confirmCta={t("switchAccountConfirmCta")}
                  cancelCta={t("switchAccountCancelCta")}
                />
              )}
              <NotificationsMenu notifications={notifications} />
            </>
          ) : (
            <>
              <LanguageSwitcher currentLocale={locale} />
              <Link
                href="/login"
                className="min-w-0 whitespace-nowrap rounded border border-border px-2 py-2 text-sm font-medium text-foreground transition hover:bg-surface sm:px-4"
              >
                {t("login")}
              </Link>
            </>
          )}
        </div>
      </div>
      </NavDrawerProvider>
    </nav>
    {user && accountType === "demo" && (
      <div className="w-full border-b border-warning/30 bg-warning/10 px-4 py-1 text-center text-[11px] font-medium text-warning lg:ps-64">
        {t("demoStrip")}
      </div>
    )}
    {user && (
      <>
        <SidebarNav isAdmin={isAdmin} />
        <BottomNav />
      </>
    )}
    </>
  );
}
