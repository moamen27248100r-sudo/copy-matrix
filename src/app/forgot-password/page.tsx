import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">نسيت كلمة المرور</h1>

      <p className="text-sm text-muted">
        أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور.
      </p>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ForgotPasswordForm />

      <p className="text-sm text-muted">
        تذكّرت كلمة المرور؟{" "}
        <Link href="/login" className="text-foreground underline">
          تسجيل الدخول
        </Link>
      </p>
    </main>
  );
}
