import { updatePassword } from "@/app/auth/actions";

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

      <form action={updatePassword} className="flex flex-col gap-3">
        <input
          name="password"
          type="password"
          placeholder="كلمة المرور الجديدة (٦ أحرف على الأقل)"
          required
          minLength={6}
          className="rounded border border-border bg-surface px-3 py-2"
        />
        <button
          type="submit"
          className="rounded border border-border bg-surface px-3 py-2 text-foreground"
        >
          تحديث كلمة المرور
        </button>
      </form>
    </main>
  );
}
