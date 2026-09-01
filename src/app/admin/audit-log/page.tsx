import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 40;

const ACTION_LABELS: Record<string, string> = {
  approve_kyc: "قبول طلب توثيق",
  reject_kyc: "رفض طلب توثيق",
  approve_wallet_request: "قبول طلب محفظة",
  reject_wallet_request: "رفض طلب محفظة",
  grant_admin: "تعيين أدمن",
  revoke_admin: "إزالة صلاحية أدمن",
  suspend_user: "تعليق حساب",
  unsuspend_user: "إلغاء تعليق حساب",
  adjust_balance: "تعديل رصيد يدوي",
  create_leader: "إنشاء متداول",
  update_leader: "تعديل متداول",
  delete_leader: "حذف متداول",
};

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data: logs, count } = await supabase
    .from("admin_audit_log")
    .select("id, action, target_type, target_id, details, created_at, profiles(display_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">سجل الإجراءات</h1>
        <span className="text-sm text-muted">{count ?? 0} إجراء</span>
      </div>
      <p className="text-xs text-muted">كل إجراء اتخذه أي أدمن على المنصة، بالترتيب الزمني الأحدث أولًا.</p>

      {(logs ?? []).length === 0 ? (
        <p className="text-sm text-muted">لا توجد إجراءات مسجلة بعد.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {logs!.map((l) => {
            const admin = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
            return (
              <div key={l.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{ACTION_LABELS[l.action] ?? l.action}</span>
                  <span className="text-xs text-muted">
                    {new Date(l.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>
                <p className="text-xs text-muted">بواسطة: {admin?.display_name ?? "—"} ({admin?.email ?? "—"})</p>
                {l.details != null && (
                  <p className="mt-1 break-words text-xs text-muted" dir="ltr">
                    {JSON.stringify(l.details)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <a
            href={`/admin/audit-log?page=${Math.max(1, page - 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            السابق
          </a>
          <span className="text-muted">
            صفحة {page} من {totalPages}
          </span>
          <a
            href={`/admin/audit-log?page=${Math.min(totalPages, page + 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            التالي
          </a>
        </div>
      )}
    </>
  );
}
