import Link from "next/link";
import { LegalNav } from "@/components/LegalNav";

export default function NotFound() {
  return (
    <>
      <LegalNav />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex items-center gap-1.5 text-5xl font-bold text-brand" dir="ltr">
          404
        </span>
        <h1 className="text-xl font-semibold">الصفحة غير موجودة</h1>
        <p className="text-sm text-muted">
          الرابط الذي حاولت الوصول إليه غير موجود أو تم نقله.
        </p>
        <Link
          href="/"
          className="rounded border border-border bg-surface px-4 py-2 text-sm text-foreground"
        >
          العودة إلى الرئيسية
        </Link>
      </main>
    </>
  );
}
