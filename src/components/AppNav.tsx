import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MainMenu } from "@/components/MainMenu";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { NavDrawerProvider } from "@/components/nav-drawer-context";

export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let balance: number | null = null;
  let displayName: string | null = null;
  let email: string | null = null;
  let notifications: { id: string; title: string; body: string | null; is_read: boolean; created_at: string }[] = [];
  if (user) {
    const [{ data: profile }, { data: notificationRows }] = await Promise.all([
      supabase.from("profiles").select("is_admin, balance, is_suspended, display_name, email").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (profile?.is_suspended) redirect("/suspended");
    isAdmin = !!profile?.is_admin;
    balance = profile?.balance ?? null;
    displayName = profile?.display_name ?? null;
    email = profile?.email ?? user.email ?? null;
    notifications = notificationRows ?? [];
  }

  return (
    <>
    <nav className="fixed inset-x-0 top-0 left-0 right-0 z-[9999] w-full border-b border-border bg-[#0b1726]">
      <NavDrawerProvider>
      <div className="mx-auto grid h-14 max-w-5xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:h-16 sm:px-6">
        <div className="flex justify-start">
          {user ? (
            <MainMenu balance={balance} isAdmin={isAdmin} displayName={displayName} email={email} />
          ) : (
            <Link
              href="/signup"
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:bg-accent-hover sm:text-sm"
            >
              إنشاء حساب
            </Link>
          )}
        </div>

        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center justify-center gap-1 whitespace-nowrap text-base font-semibold sm:gap-1.5 sm:text-lg"
          dir="ltr"
        >
          Copy Matrix
          <span className="flex items-center">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 19l3-5 3 3 5-9" />
              <path d="M12 8h4v4" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="-ml-1.5 h-4 w-4 text-brand"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 19l3-5 3 3 5-9" />
              <path d="M12 8h4v4" />
            </svg>
          </span>
        </Link>

        <div className="flex justify-end">
          {user ? (
            <NotificationsMenu notifications={notifications} />
          ) : (
            <Link href="/login" className="text-xs font-medium text-foreground underline sm:text-sm">
              تسجيل الدخول
            </Link>
          )}
        </div>
      </div>
      </NavDrawerProvider>
    </nav>
    <div className="h-14 sm:h-16" aria-hidden="true" />
    </>
  );
}
