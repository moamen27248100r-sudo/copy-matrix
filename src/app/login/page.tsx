import Link from "next/link";
import { login } from "@/app/auth/actions";
import { safeNextPath } from "@/lib/safe-next";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">تسجيل الدخول</h1>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={login} className="flex flex-col gap-3">
        {next && <input type="hidden" name="next" value={next} />}
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
          className="rounded bg-accent px-3 py-2 font-medium text-accent-foreground transition hover:bg-accent-hover"
        >
          تسجيل الدخول
        </button>
      </form>

      <Link href="/forgot-password" className="text-sm text-muted underline">
        نسيت كلمة المرور؟
      </Link>

      <p className="text-sm text-muted">
        ألا تملك حسابًا؟{" "}
        <Link href={signupHref} className="text-foreground underline">
          إنشاء حساب جديد
        </Link>
      </p>
    </main>
  );
}
