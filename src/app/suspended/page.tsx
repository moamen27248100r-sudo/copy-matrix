import { logout } from "@/app/auth/actions";

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">تم تعليق الحساب</h1>
      <p className="text-sm text-muted">
        تم تعليق هذا الحساب من قبل فريق الإدارة. إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع الدعم.
      </p>
      <form action={logout}>
        <button type="submit" className="rounded border border-border px-4 py-2 text-sm">
          تسجيل الخروج
        </button>
      </form>
    </main>
  );
}
