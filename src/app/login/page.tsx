import Link from "next/link";
import { login } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">تسجيل الدخول</h1>
        <ThemeToggle />
      </div>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="البريد الإلكتروني"
          required
          className="rounded border border-border bg-surface px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="كلمة المرور"
          required
          className="rounded border border-border bg-surface px-3 py-2"
        />
        <button
          type="submit"
          className="rounded border border-border bg-surface px-3 py-2 text-foreground"
        >
          تسجيل الدخول
        </button>
      </form>

      <p className="text-sm text-muted">
        ألا تملك حسابًا؟{" "}
        <Link href="/signup" className="text-foreground underline">
          إنشاء حساب جديد
        </Link>
      </p>
    </main>
  );
}
