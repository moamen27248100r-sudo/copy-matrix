import { adminLogin } from "@/app/admin/login/actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">لوحة الإدارة</h1>
        <p className="mt-1 text-sm text-muted">دخول مخصص لفريق الإدارة فقط.</p>
      </div>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <form action={adminLogin} className="flex flex-col gap-3">
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
          دخول
        </button>
      </form>
    </main>
  );
}
