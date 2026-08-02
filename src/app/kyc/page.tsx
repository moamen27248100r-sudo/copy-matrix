import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitKyc } from "@/app/kyc/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: submission } = await supabase
    .from("kyc_submissions")
    .select("status, submitted_at, reviewed_at")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">توثيق الهوية</h1>
        <ThemeToggle />
      </div>

      {submission ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm">
            حالة الطلب:{" "}
            <span className="font-medium">
              {STATUS_LABELS[submission.status] ?? submission.status}
            </span>
          </p>
          <p className="text-xs text-muted">
            تاريخ التقديم: {new Date(submission.submitted_at).toLocaleDateString("ar-EG")}
          </p>
          {submission.status === "pending" && (
            <p className="text-sm text-muted">
              طلبك قيد المراجعة حاليًا. سيتم إشعارك فور اتخاذ قرار.
            </p>
          )}
          {submission.status === "rejected" && (
            <p className="text-sm text-danger">
              تم رفض طلبك. يرجى التواصل مع الدعم لمعرفة السبب وإعادة التقديم.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">
            أكمل بيانات التوثيق التالية. هذه الخطوة مطلوبة قبل تفعيل الحساب بالكامل.
          </p>

          {error && (
            <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <form action={submitKyc} className="flex flex-col gap-3">
            <input
              name="fullName"
              type="text"
              placeholder="الاسم الكامل كما في الهوية"
              required
              className="rounded border border-border bg-surface px-3 py-2"
            />
            <input
              name="nationalIdNumber"
              type="text"
              placeholder="الرقم القومي / رقم الهوية"
              required
              className="rounded border border-border bg-surface px-3 py-2"
            />
            <label className="flex flex-col gap-1 text-sm">
              صورة إثبات الهوية (بطاقة/جواز سفر)
              <input
                name="idDocument"
                type="file"
                accept="image/*,.pdf"
                required
                className="rounded border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              إثبات العنوان (اختياري)
              <input
                name="addressProof"
                type="file"
                accept="image/*,.pdf"
                className="rounded border border-border bg-surface px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" className="rounded bg-brand px-3 py-2 text-brand-foreground">
              إرسال للمراجعة
            </button>
          </form>
        </>
      )}

      <Link href="/dashboard" className="text-sm underline">
        العودة إلى لوحة التحكم
      </Link>
    </main>
  );
}
