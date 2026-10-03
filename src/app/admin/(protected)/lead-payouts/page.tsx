import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { approveLeadPayout, rejectLeadPayout } from "@/app/admin/actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

export default async function AdminLeadPayoutsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("lead_trader_payout_requests")
    .select("id, user_id, provider_id, amount, destination, status, admin_note, created_at, providers(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const name = (r: { providers: { display_name: string | null } | { display_name: string | null }[] | null }) =>
    (Array.isArray(r.providers) ? r.providers[0] : r.providers)?.display_name ?? "—";
  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const recent = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">سحب أرباح القادة</h1>
      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">قيد المراجعة ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted">لا توجد طلبات.</p>}
        {pending.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="font-medium">
                {formatMoney(Number(r.amount), "ar")} · {name(r)}
              </p>
              <p className="break-all text-xs text-muted" dir="ltr">
                {r.destination}
              </p>
              <p className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString("ar-EG")}</p>
            </div>
            <form className="flex flex-wrap gap-2">
              <input type="hidden" name="requestId" value={r.id} />
              <input name="note" placeholder="ملاحظة (اختياري)" className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-base" />
              <button formAction={approveLeadPayout} className="rounded bg-success px-3 py-1.5 text-sm font-medium text-white">
                قبول
              </button>
              <button formAction={rejectLeadPayout} className="rounded border border-danger/50 px-3 py-1.5 text-sm text-danger">
                رفض
              </button>
            </form>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">آخر الطلبات</h2>
        {recent.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <span>
              {formatMoney(Number(r.amount), "ar")} · {name(r)}
            </span>
            <span className="text-xs text-muted">{STATUS_LABELS[r.status] ?? r.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
