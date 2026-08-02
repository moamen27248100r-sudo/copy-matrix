import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          مرحبًا، {profile?.display_name ?? user.email}
        </h1>
        <ThemeToggle />
      </div>
      <p className="text-sm text-muted">{user.email}</p>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/discover"
          className="w-fit rounded bg-brand px-3 py-2 text-sm text-brand-foreground"
        >
          اكتشاف المتداولين
        </Link>
        <Link
          href="/portfolio"
          className="w-fit rounded border border-border px-3 py-2 text-sm"
        >
          محفظتي
        </Link>
        <Link
          href="/provider"
          className="w-fit rounded border border-border px-3 py-2 text-sm"
        >
          لوحة المتداول
        </Link>
        <Link
          href="/kyc"
          className="w-fit rounded border border-border px-3 py-2 text-sm"
        >
          توثيق الهوية
        </Link>
      </div>

      <form action={logout}>
        <button
          type="submit"
          className="w-fit rounded border border-border px-3 py-2 text-sm"
        >
          تسجيل الخروج
        </button>
      </form>
    </main>
  );
}
