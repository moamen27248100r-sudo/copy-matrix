import { createClient } from "@/lib/supabase/server";
import { approveKyc, rejectKyc } from "@/app/admin/actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("kyc_submissions")
      .select("id, full_name, national_id_number, id_document_path, address_proof_path, status, submitted_at")
      .eq("status", "pending")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("kyc_submissions")
      .select("id, full_name, national_id_number, status, submitted_at, reviewed_at")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(20),
  ]);

  const withUrls = await Promise.all(
    (pending ?? []).map(async (s) => {
      const { data: idUrl } = await supabase.storage.from("kyc-documents").createSignedUrl(s.id_document_path, 60 * 10);
      const addressUrl = s.address_proof_path
        ? (await supabase.storage.from("kyc-documents").createSignedUrl(s.address_proof_path, 60 * 10)).data
        : null;
      return { ...s, idDocumentUrl: idUrl?.signedUrl, addressProofUrl: addressUrl?.signedUrl };
    }),
  );

  return (
    <>
      <h1 className="text-2xl font-semibold">طلبات التوثيق</h1>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">طلبات معلقة</h2>
        {withUrls.length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات توثيق معلقة.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {withUrls.map((s) => (
              <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted">رقم الهوية: {s.national_id_number}</p>
                    <p className="text-xs text-muted">تاريخ التقديم: {new Date(s.submitted_at).toLocaleDateString("ar-EG")}</p>
                  </div>
                  <span className="rounded border border-border px-2 py-1 text-xs">{STATUS_LABELS[s.status] ?? s.status}</span>
                </div>

                <div className="flex gap-3">
                  {s.idDocumentUrl && (
                    <a href={s.idDocumentUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                      عرض إثبات الهوية
                    </a>
                  )}
                  {s.addressProofUrl && (
                    <a href={s.addressProofUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                      عرض إثبات العنوان
                    </a>
                  )}
                </div>

                <div className="flex gap-3">
                  <form action={approveKyc}>
                    <input type="hidden" name="submissionId" value={s.id} />
                    <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover">
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
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">آخر القرارات</h2>
        {(recent ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد قرارات سابقة بعد.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recent!.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
                <div>
                  <p>{r.full_name}</p>
                  <p className="text-xs text-muted">
                    {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("ar-EG") : "—"}
                  </p>
                </div>
                <span
                  className={
                    r.status === "approved"
                      ? "rounded border border-success/40 px-2 py-0.5 text-xs text-success"
                      : "rounded border border-danger/40 px-2 py-0.5 text-xs text-danger"
                  }
                >
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
