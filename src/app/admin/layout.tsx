import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { logout } from "@/app/auth/actions";

const NAV_ITEMS = [
  { href: "/admin", label: "نظرة عامة" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/traders", label: "المتداولون" },
  { href: "/admin/kyc", label: "طلبات التوثيق" },
  { href: "/admin/wallet-requests", label: "طلبات المحفظة" },
  { href: "/admin/subscriptions", label: "نشاط النسخ" },
  { href: "/admin/audit-log", label: "سجل الإجراءات" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/admin/login?error=" + encodeURIComponent("هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة."));
  }

  return (
    <>
      <nav className="sticky top-0 z-[9999] w-full border-b border-border bg-[#0b1726]">
        <div className="mx-auto max-w-5xl px-3 sm:px-6">
          <div className="flex h-14 items-center justify-between sm:h-16">
            <Link href="/admin" className="flex items-center gap-2 overflow-hidden">
              <Logo iconClassName="h-4 w-4 sm:h-5 sm:w-5" textClassName="text-base sm:text-xl" />
            </Link>
            <div className="flex items-center gap-3">
              <span className="rounded border border-border px-2.5 py-1 text-xs font-medium text-muted">
                لوحة الإدارة
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="whitespace-nowrap rounded border border-border px-2.5 py-1.5 text-sm text-foreground transition hover:bg-surface"
                >
                  تسجيل الخروج
                </button>
              </form>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-sm text-muted">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded px-1 py-1 transition hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6">{children}</main>
    </>
  );
}
