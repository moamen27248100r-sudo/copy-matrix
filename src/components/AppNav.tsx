import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { BottomNav } from "@/components/BottomNav";

const PRIMARY_HREFS = new Set(["/dashboard", "/discover", "/markets", "/portfolio"]);

const LINKS = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/discover", label: "اكتشاف المتداولين" },
  { href: "/markets", label: "الأسواق" },
  { href: "/portfolio", label: "محفظتي" },
  { href: "/kyc", label: "توثيق الهوية" },
  { href: "/settings", label: "الإعدادات" },
];

export async function AppNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let balance: number | null = null;
  let unreadCount = 0;
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("is_admin, balance, is_suspended").eq("id", user.id).single(),
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
  }

  const links = isAdmin ? [...LINKS, { href: "/admin", label: "لوحة الإدارة" }] : LINKS;
  const mobileMenuLinks = links.filter((l) => !PRIMARY_HREFS.has(l.href));

  return (
    <>
    <nav className="border-b border-border">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-lg font-semibold" dir="ltr">
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

          <div className="flex items-center gap-2">
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
            {user && balance != null && (
              <Link
                href="/portfolio"
                className="shrink-0 rounded border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground sm:px-3 sm:text-sm"
              >
                ${Number(balance).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </Link>
            )}
            {user && (
              <form action={logout} className="hidden sm:block">
                <button type="submit" className="rounded border border-border px-3 py-1.5 text-sm">
                  تسجيل الخروج
                </button>
              </form>
            )}
            <label
              htmlFor="app-nav-toggle"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded border border-border text-foreground sm:hidden"
              aria-label="القائمة"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </label>
          </div>
        </div>

        <input type="checkbox" id="app-nav-toggle" className="peer hidden" />
        <div className="hidden flex-col gap-3 border-t border-border pt-3 mt-3 text-sm peer-checked:flex sm:hidden">
          {mobileMenuLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted hover:text-foreground">
              {l.label}
            </Link>
          ))}
          {user && (
            <form action={logout}>
              <button type="submit" className="rounded border border-border px-3 py-1.5 text-sm">
                تسجيل الخروج
              </button>
            </form>
          )}
        </div>

        <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 sm:pt-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
    {user && <BottomNav />}
    </>
  );
}
