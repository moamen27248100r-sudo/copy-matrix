import { createClient } from "@/lib/supabase/server";
import { approveLeadTraderApplication, rejectLeadTraderApplication } from "@/app/admin/actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export default async function AdminLeadTraderApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("lead_trader_applications")
      .select("id, user_id, display_name, bio, markets, trading_style, contact_info, requested_min_investment, submitted_at")
      .eq("status", "pending")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("lead_trader_applications")
      .select("id, display_name, status, reviewed_at, rejection_reason")
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">طلبات المتداول القائد</h1>

      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">طلبات معلقة</h2>
        {(pending ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات معلقة.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {pending!.map((a) => (
              <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{a.display_name}</p>
                    <p className="text-xs text-muted">
                      {a.trading_style ?? "—"} · {(a.markets ?? []).join("، ") || "—"}
                    </p>
                    <p className="text-xs text-muted">تاريخ التقديم: {new Date(a.submitted_at).toLocaleDateString("ar-EG")}</p>
                  </div>
                  <span className="shrink-0 rounded border border-border px-2 py-1 text-xs">{STATUS_LABELS.pending}</span>
                </div>
                {a.bio && <p className="text-sm text-muted">{a.bio}</p>}
                <p className="text-xs text-muted">وسيلة التواصل (خاصة): {a.contact_info ?? "—"}</p>
                <p className="text-xs text-muted">الحد الأدنى المقترح للاستثمار: {a.requested_min_investment ?? "—"}</p>

                <div className="flex flex-wrap gap-3">
                  <form action={approveLeadTraderApplication}>
                    <input type="hidden" name="applicationId" value={a.id} />
                    <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover">
                      قبول
                    </button>
                  </form>
                  <form action={rejectLeadTraderApplication} className="flex items-center gap-2">
                    <input type="hidden" name="applicationId" value={a.id} />
                    <input
                      name="reason"
                      type="text"
                      placeholder="سبب الرفض (اختياري)"
                      className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                    />
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
                  <p>{r.display_name}</p>
                  <p className="text-xs text-muted">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("ar-EG") : "—"}</p>
                  {r.rejection_reason && <p className="text-xs text-muted">السبب: {r.rejection_reason}</p>}
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
