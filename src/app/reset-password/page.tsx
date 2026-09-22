import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">تعيين كلمة مرور جديدة</h1>

      <p className="text-sm text-muted">أدخل كلمة المرور الجديدة لحسابك.</p>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ResetPasswordForm />
    </main>
  );
}
