import { createClient } from "@/lib/supabase/server";
import { approveWalletRequest, rejectWalletRequest } from "@/app/admin/actions";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

type ProfileRef = { display_name: string | null; email: string | null } | { display_name: string | null; email: string | null }[] | null;

function oneProfile(p: ProfileRef) {
  return Array.isArray(p) ? p[0] : p;
}

type PendingRequest = {
  id: string;
  type: string;
  amount: number;
  status: string;
  note: string | null;
  requested_at: string;
  profiles: ProfileRef;
};

type RecentRequest = {
  id: string;
  type: string;
  amount: number;
  status: string;
  requested_at: string;
  profiles: ProfileRef;
};

function PendingCard({ r }: { r: PendingRequest }) {
  const profile = oneProfile(r.profiles);
  const isDeposit = r.type === "deposit";
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="font-medium">${Number(r.amount).toLocaleString("en-US")} <span className="text-xs font-normal text-muted">(المبلغ الذي طلبه العميل)</span></p>
        <p className="text-xs text-muted">
          {profile?.display_name} · {profile?.email}
        </p>
        {r.note && <p className="text-xs text-muted">{r.note}</p>}
        <p className="text-xs text-muted">{new Date(r.requested_at).toLocaleDateString("ar-EG")}</p>
      </div>

      <form action={approveWalletRequest} className="flex flex-col gap-2">
        <input type="hidden" name="requestId" value={r.id} />
        {isDeposit && (
          <label className="flex flex-col gap-1 text-xs text-muted">
            المبلغ الذي وصل فعليًا (تحقّق منه قبل القبول)
            <input
              name="actualAmount"
              type="number"
              step="any"
              min={0.01}
              required
              defaultValue={r.amount}
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        )}
        <div className="flex gap-3">
          <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover">
            قبول
          </button>
          <button
            type="submit"
            formAction={rejectWalletRequest}
            className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger"
          >
            رفض
          </button>
        </div>
      </form>
    </div>
  );
}

function RecentRow({ r }: { r: RecentRequest }) {
  const profile = oneProfile(r.profiles);
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
      <div>
        <p>
          ${Number(r.amount).toLocaleString("en-US")} · {profile?.display_name}
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
}

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
      .select("id, user_id, type, amount, status, note, requested_at, profiles(display_name, email)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false }),
    supabase
      .from("wallet_requests")
      .select("id, type, amount, status, requested_at, profiles(display_name, email)")
      .neq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(40),
  ]);

  const pendingDeposits = (pending ?? []).filter((r) => r.type === "deposit") as PendingRequest[];
  const pendingWithdrawals = (pending ?? []).filter((r) => r.type === "withdrawal") as PendingRequest[];
  const recentDeposits = (recent ?? []).filter((r) => r.type === "deposit").slice(0, 20) as RecentRequest[];
  const recentWithdrawals = (recent ?? []).filter((r) => r.type === "withdrawal").slice(0, 20) as RecentRequest[];

  return (
    <>
      <h1 className="text-2xl font-semibold">طلبات الإيداع والسحب</h1>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">طلبات معلقة</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted">طلبات الإيداع ({pendingDeposits.length})</h3>
            {pendingDeposits.length === 0 ? (
              <p className="text-sm text-muted">لا توجد طلبات إيداع معلقة حاليًا.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingDeposits.map((r) => (
                  <PendingCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted">طلبات السحب ({pendingWithdrawals.length})</h3>
            {pendingWithdrawals.length === 0 ? (
              <p className="text-sm text-muted">لا توجد طلبات سحب معلقة حاليًا.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingWithdrawals.map((r) => (
                  <PendingCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">آخر القرارات</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted">إيداعات</h3>
            {recentDeposits.length === 0 ? (
              <p className="text-sm text-muted">لا توجد قرارات إيداع سابقة بعد.</p>
            ) : (
              recentDeposits.map((r) => <RecentRow key={r.id} r={r} />)
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted">سحوبات</h3>
            {recentWithdrawals.length === 0 ? (
              <p className="text-sm text-muted">لا توجد قرارات سحب سابقة بعد.</p>
            ) : (
              recentWithdrawals.map((r) => <RecentRow key={r.id} r={r} />)
            )}
          </div>
        </div>
      </section>
    </>
  );
}
