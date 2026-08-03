import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveKyc, rejectKyc } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  const { data: submissions } = await supabase
    .from("kyc_submissions")
    .select("id, full_name, national_id_number, id_document_path, address_proof_path, status, submitted_at")
    .order("submitted_at", { ascending: false });

  const withUrls = await Promise.all(
    (submissions ?? []).map(async (s) => {
      const { data: idUrl } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(s.id_document_path, 60 * 10);
      const addressUrl = s.address_proof_path
        ? (
            await supabase.storage
              .from("kyc-documents")
              .createSignedUrl(s.address_proof_path, 60 * 10)
          ).data
        : null;
      return { ...s, idDocumentUrl: idUrl?.signedUrl, addressProofUrl: addressUrl?.signedUrl };
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">مراجعة طلبات التوثيق</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="underline">
            لوحة التحكم
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {withUrls.length === 0 ? (
        <p className="text-sm text-muted">لا توجد طلبات توثيق حتى الآن.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {withUrls.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted">رقم الهوية: {s.national_id_number}</p>
                  <p className="text-xs text-muted">
                    تاريخ التقديم: {new Date(s.submitted_at).toLocaleDateString("ar-EG")}
                  </p>
                </div>
                <span className="rounded border border-border px-2 py-1 text-xs">
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>

              <div className="flex gap-3">
                {s.idDocumentUrl && (
                  <a href={s.idDocumentUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                    عرض إثبات الهوية
                  </a>
                )}
                {s.addressProofUrl && (
                  <a
                    href={s.addressProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    عرض إثبات العنوان
                  </a>
                )}
              </div>

              {s.status === "pending" && (
                <div className="flex gap-3">
                  <form action={approveKyc}>
                    <input type="hidden" name="submissionId" value={s.id} />
                    <button type="submit" className="rounded bg-foreground px-3 py-1.5 text-sm text-background">
                      قبول
                    </button>
                  </form>
                  <form action={rejectKyc}>
                    <input type="hidden" name="submissionId" value={s.id} />
                    <button type="submit" className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger">
                      رفض
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
