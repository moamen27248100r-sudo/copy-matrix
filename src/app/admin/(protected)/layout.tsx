import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { logout } from "@/app/auth/actions";
import { AdminSidebar, AdminMobileMenuButton } from "@/components/AdminSidebar";

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
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-2 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5">
            <AdminMobileMenuButton />
            <Link href="/admin" className="flex min-w-0 items-center gap-2 overflow-hidden">
              <Logo iconClassName="h-4 w-4 sm:h-5 sm:w-5" textClassName="text-base sm:text-xl" />
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden rounded border border-border px-2.5 py-1 text-xs font-medium text-muted sm:inline-block">
              لوحة الإدارة
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="whitespace-nowrap rounded border border-border px-2 py-1.5 text-sm text-foreground transition hover:bg-surface sm:px-2.5"
              >
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </nav>
      <div className="mx-auto flex w-full max-w-7xl">
        <AdminSidebar />
        <main className="flex min-w-0 flex-1 flex-col gap-8 p-6">{children}</main>
      </div>
    </>
  );
}
