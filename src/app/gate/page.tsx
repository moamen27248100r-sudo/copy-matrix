import { unlockSite } from "@/app/gate/actions";

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">الوصول محدود</h1>
      <p className="text-sm text-muted">
        هذه المنصة قيد التطوير وغير متاحة للجمهور حاليًا. أدخل كلمة المرور للمتابعة.
      </p>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          كلمة المرور غير صحيحة.
        </p>
      )}

      <form action={unlockSite} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next ?? "/"} />
        <input
          name="password"
          type="password"
          placeholder="كلمة المرور"
          required
          className="rounded border border-border bg-surface px-3 py-2"
        />
        <button type="submit" className="rounded border border-border bg-surface px-3 py-2 text-foreground">
          دخول
        </button>
      </form>
    </main>
  );
}
