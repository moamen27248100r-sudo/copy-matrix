import Link from "next/link";
import { VerifyCodeForm } from "@/components/VerifyCodeForm";

export default async function VerifyCodePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">أدخل كود التحقق</h1>

      <p className="text-sm text-muted">
        إذا كان البريد الإلكتروني{email ? ` (${email})` : ""} مسجَّلًا لدينا، فسنرسل لك كودًا مكوَّنًا من 8 أرقام.
        اكتبه هنا لمتابعة تعيين كلمة مرور جديدة.
      </p>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <VerifyCodeForm email={email ?? ""} />

      <p className="text-sm text-muted">
        لم يصلك الكود؟{" "}
        <Link href="/forgot-password" className="text-foreground underline">
          اطلب كودًا جديدًا
        </Link>
      </p>
    </main>
  );
}
