import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-5 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-1.5 text-xl font-semibold" dir="ltr">
          Copy Matrix
          <span className="flex items-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 19l3-5 3 3 5-9" />
              <path d="M12 8h4v4" />
            </svg>
            <svg viewBox="0 0 24 24" className="-ml-1.5 h-5 w-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 19l3-5 3 3 5-9" />
              <path d="M12 8h4v4" />
            </svg>
          </span>
        </div>
        <div>
          <h1 className="text-lg font-semibold">إنشاء حساب جديد</h1>
          <p className="text-sm text-muted">انضم وابدأ نسخ صفقات أفضل المتداولين في دقائق.</p>
        </div>
      </div>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-lg">
        <SignupForm />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        أو
        <span className="h-px flex-1 bg-border" />
      </div>

      <Link
        href="/login"
        className="rounded border border-border px-3 py-2 text-center font-medium text-foreground transition hover:border-accent hover:text-accent"
      >
        لدي حساب بالفعل — تسجيل الدخول
      </Link>
    </main>
  );
}
