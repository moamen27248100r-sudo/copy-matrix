import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MainMenu } from "@/components/MainMenu";

export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let balance: number | null = null;
  let unreadCount = 0;
  let displayName: string | null = null;
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("is_admin, balance, is_suspended, display_name").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
    ]);
    if (profile?.is_suspended) redirect("/suspended");
    isAdmin = !!profile?.is_admin;
    balance = profile?.balance ?? null;
    unreadCount = count ?? 0;
    displayName = profile?.display_name ?? null;
  }

  return (
    <nav className="border-b border-border">
      <div className="mx-auto grid max-w-5xl grid-cols-3 items-center px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex justify-start">
          {user && <MainMenu balance={balance} isAdmin={isAdmin} displayName={displayName} />}
        </div>

        <Link href="/dashboard" className="flex items-center justify-center gap-1.5 text-lg font-semibold" dir="ltr">
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
          {user && (
            <Link
              href="/notifications"
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border text-foreground"
              aria-label="الإشعارات"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
