import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { recheckCryptoDeposit } from "@/app/admin/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ADMIN_DEPOSIT_FAILURE, ADMIN_DEPOSIT_STATUS, ADMIN_STATUS_TONE } from "@/lib/crypto/admin-labels";
import { displayTxHash, explorerTxUrl, isNetworkId, shortAddress } from "@/lib/crypto/networks";

type ProfileRef = { display_name: string | null; email: string | null } | { display_name: string | null; email: string | null }[] | null;
const oneProfile = (p: ProfileRef) => (Array.isArray(p) ? p[0] : p);

type Deposit = {
  id: string;
  user_id: string;
  network: string;
  tx_hash: string;
  amount: number | null;
  confirmations: number;
  required_confirmations: number;
  status: string;
  failure_reason: string | null;
  check_attempts: number;
  last_checked_at: string | null;
  created_at: string;
  profiles: ProfileRef;
};

const FILTERS: Record<string, string> = { all: "الكل", pending: "بانتظار التأكيدات", completed: "مكتمل", failed: "فشل" };

export default async function AdminDepositsPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string }> }) {
  const { status = "all", error } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("crypto_deposits")
    .select(
      "id, user_id, network, tx_hash, amount, confirmations, required_confirmations, status, failure_reason, check_attempts, last_checked_at, created_at, profiles(display_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status in ADMIN_DEPOSIT_STATUS) query = query.eq("status", status);
  const { data } = await query;
  const rows = (data ?? []) as Deposit[];

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">الإيداعات</h1>
        <p className="text-sm text-muted">
          يتم التحقق من كل إيداع تلقائياً على البلوكتشين (المستلم، عقد USDT الرسمي، التأكيدات)، والمبلغ يُؤخذ من البلوكتشين نفسه. العمليات المعلقة
          يُعاد فحصها تلقائياً كل دقيقة.
        </p>
      </div>
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <nav className="flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([key, label]) => (
          <Link
            key={key}
            href={key === "all" ? "/admin/deposits" : `/admin/deposits?status=${key}`}
            className={`rounded-full border px-3 py-1 text-sm ${status === key ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">لا توجد إيداعات.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pe-3 text-start">التاريخ</th>
                <th className="py-2 pe-3 text-start">العميل</th>
                <th className="py-2 pe-3 text-start">الشبكة</th>
                <th className="py-2 pe-3 text-start">المبلغ (من البلوكتشين)</th>
                <th className="py-2 pe-3 text-start">الحالة</th>
                <th className="py-2 pe-3 text-start">TxID</th>
                <th className="py-2 pe-3 text-start">آخر فحص</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const profile = oneProfile(d.profiles);
                return (
                  <tr key={d.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pe-3 text-xs text-muted">{new Date(d.created_at).toLocaleString("ar-EG")}</td>
                    <td className="py-2 pe-3">
                      <Link href={`/admin/users/${d.user_id}`} className="hover:underline">
                        {profile?.display_name ?? profile?.email}
                      </Link>
                    </td>
                    <td className="py-2 pe-3">{d.network}</td>
                    <td className="py-2 pe-3">{d.amount != null ? formatMoney(Number(d.amount), "ar") : "—"}</td>
                    <td className="py-2 pe-3">
                      <span className={`rounded border px-2 py-0.5 text-xs ${ADMIN_STATUS_TONE[d.status] ?? "border-border"}`}>
                        {ADMIN_DEPOSIT_STATUS[d.status] ?? d.status}
                        {d.status === "pending" && ` (${d.confirmations}/${d.required_confirmations})`}
                      </span>
                      {d.failure_reason && <p className="mt-1 text-[11px] text-muted">{ADMIN_DEPOSIT_FAILURE[d.failure_reason] ?? d.failure_reason}</p>}
                    </td>
                    <td className="py-2 pe-3 text-xs">
                      {isNetworkId(d.network) ? (
                        <a href={explorerTxUrl(d.network, d.tx_hash)} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-mono text-accent hover:underline">
                          {shortAddress(displayTxHash(d.network, d.tx_hash), 10, 6)}
                        </a>
                      ) : (
                        d.tx_hash
                      )}
                    </td>
                    <td className="py-2 pe-3 text-xs text-muted">
                      {d.last_checked_at ? new Date(d.last_checked_at).toLocaleTimeString("ar-EG") : "—"} · {d.check_attempts} محاولة
                      {d.status === "pending" && (
                        <form action={recheckCryptoDeposit} className="mt-1">
                          <input type="hidden" name="id" value={d.id} />
                          <SubmitButton className="rounded border border-border px-2 py-0.5 text-xs text-foreground hover:bg-surface disabled:opacity-50">
                            فحص الآن
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
