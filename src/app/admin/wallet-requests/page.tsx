import { createClient } from "@/lib/supabase/server";
import { approveWalletRequest, rejectWalletRequest } from "@/app/admin/actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export default async function AdminWalletRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("wallet_requests")
      .select("id, user_id, type, amount, status, requested_at, profiles(display_name, email)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false }),
    supabase
      .from("wallet_requests")
      .select("id, type, amount, status, requested_at, profiles(display_name, email)")
      .neq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">طلبات الإيداع والسحب</h1>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">طلبات معلقة</h2>
        {(pending ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات معلقة حاليًا.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending!.map((r) => {
              const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {r.type === "deposit" ? "طلب إيداع" : "طلب سحب"} — ${Number(r.amount).toLocaleString("en-US")}
                    </p>
                    <p className="text-xs text-muted">
                      {profile?.display_name} · {profile?.email}
                    </p>
                    <p className="text-xs text-muted">{new Date(r.requested_at).toLocaleDateString("ar-EG")}</p>
                  </div>
                  <div className="flex gap-3">
                    <form action={approveWalletRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover">
                        قبول
                      </button>
                    </form>
                    <form action={rejectWalletRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button type="submit" className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger">
                        رفض
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">آخر القرارات</h2>
        {(recent ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد قرارات سابقة بعد.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recent!.map((r) => {
              const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
                  <div>
                    <p>
                      {r.type === "deposit" ? "إيداع" : "سحب"} — ${Number(r.amount).toLocaleString("en-US")} ·{" "}
                      {profile?.display_name}
                    </p>
                    <p className="text-xs text-muted">{new Date(r.requested_at).toLocaleDateString("ar-EG")}</p>
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
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
