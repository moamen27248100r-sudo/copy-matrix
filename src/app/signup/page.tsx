import Link from "next/link";
import { signup } from "@/app/auth/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">إنشاء حساب</h1>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={signup} className="flex flex-col gap-3">
        <input
          name="displayName"
          type="text"
          placeholder="الاسم الكامل"
          required
          className="rounded border border-border bg-surface px-3 py-2"
        />
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
          placeholder="كلمة المرور (٦ أحرف على الأقل)"
          required
          minLength={6}
          className="rounded border border-border bg-surface px-3 py-2"
        />

        <button
          type="submit"
          className="rounded bg-accent px-3 py-2 font-medium text-accent-foreground transition hover:bg-accent-hover"
        >
          إنشاء حساب
        </button>
      </form>

      <p className="text-xs text-muted">
        بإنشائك حسابًا فإنك توافق على{" "}
        <Link href="/legal/terms" className="underline">
          الشروط والأحكام
        </Link>{" "}
        و{" "}
        <Link href="/legal/privacy" className="underline">
          سياسة الخصوصية
        </Link>
        .
      </p>

      <p className="text-sm text-muted">
        هل تملك حسابًا بالفعل؟{" "}
        <Link href="/login" className="text-foreground underline">
          تسجيل الدخول
        </Link>
      </p>
    </main>
  );
}
