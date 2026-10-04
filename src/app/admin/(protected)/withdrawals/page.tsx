import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { completeCryptoWithdrawal, rejectCryptoWithdrawal, startCryptoWithdrawal } from "@/app/admin/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ADMIN_STATUS_TONE, ADMIN_WITHDRAWAL_STATUS } from "@/lib/crypto/admin-labels";
import { displayTxHash, explorerAddressUrl, explorerTxUrl, isNetworkId, shortAddress } from "@/lib/crypto/networks";

type ProfileRef = { display_name: string | null; email: string | null } | { display_name: string | null; email: string | null }[] | null;
const oneProfile = (p: ProfileRef) => (Array.isArray(p) ? p[0] : p);

type Withdrawal = {
  id: string;
  user_id: string;
  network: string;
  address: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  tx_hash: string | null;
  reject_reason: string | null;
  created_at: string;
  completed_at: string | null;
  profiles: ProfileRef;
};

const SELECT = "id, user_id, network, address, amount, fee, net_amount, status, tx_hash, reject_reason, created_at, completed_at, profiles!crypto_withdrawals_user_id_fkey(display_name, email)";

function StatusChip({ status }: { status: string }) {
  return <span className={`rounded border px-2 py-0.5 text-xs ${ADMIN_STATUS_TONE[status] ?? "border-border"}`}>{ADMIN_WITHDRAWAL_STATUS[status] ?? status}</span>;
}

function QueueCard({ w }: { w: Withdrawal }) {
  const profile = oneProfile(w.profiles);
  const net = isNetworkId(w.network) ? w.network : null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">
            {formatMoney(Number(w.net_amount), "ar", { decimals: 6 })} <span className="text-xs font-normal text-muted">(المبلغ المطلوب إرساله)</span>
          </p>
          <p className="text-xs text-muted">
            المخصوم من الرصيد {formatMoney(Number(w.amount), "ar")} · الرسوم {formatMoney(Number(w.fee), "ar")} · {w.network}
          </p>
          <Link href={`/admin/users/${w.user_id}`} className="text-xs text-accent hover:underline">
            {profile?.display_name} · {profile?.email}
          </Link>
          <p className="text-xs text-muted">{new Date(w.created_at).toLocaleString("ar-EG")}</p>
        </div>
        <StatusChip status={w.status} />
      </div>

      <div className="rounded border border-border bg-background px-3 py-2">
        <p className="text-[11px] text-muted">عنوان العميل ({w.network})</p>
        <p dir="ltr" className="select-all break-all font-mono text-sm">
          {w.address}
        </p>
        {net && (
          <a href={explorerAddressUrl(net, w.address)} target="_blank" rel="noopener noreferrer" className="text-[11px] text-accent hover:underline">
            عرض العنوان في المستكشف
          </a>
        )}
      </div>

      {w.status === "processing" ? (
        <form action={startCryptoWithdrawal}>
          <input type="hidden" name="id" value={w.id} />
          <SubmitButton className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50">
            بدء التنفيذ (يمنع العميل من الإلغاء)
          </SubmitButton>
        </form>
      ) : (
        <form action={completeCryptoWithdrawal} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={w.id} />
          <label className="flex flex-col gap-1 text-xs text-muted">
            بعد الإرسال من محفظة المنصة، أدخل رقم العملية (TxID)
            <input name="txHash" required dir="ltr" autoComplete="off" className="rounded border border-border bg-background px-3 py-2 font-mono text-sm text-foreground" />
          </label>
          <SubmitButton className="self-start rounded bg-success px-3 py-1.5 text-sm font-medium text-background transition disabled:opacity-50">
            تأكيد الإرسال وإكمال الطلب
          </SubmitButton>
        </form>
      )}

      <form action={rejectCryptoWithdrawal} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <input type="hidden" name="id" value={w.id} />
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          سبب الرفض (يظهر للعميل)
          <input name="reason" maxLength={300} className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground" />
        </label>
        <ConfirmButton confirmText="رفض الطلب وإرجاع المبلغ لرصيد العميل؟" className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger">
          رفض وإرجاع المبلغ
        </ConfirmButton>
      </form>
    </div>
  );
}

export default async function AdminWithdrawalsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: queue }, { data: recent }] = await Promise.all([
    supabase.from("crypto_withdrawals").select(SELECT).in("status", ["processing", "sending"]).order("created_at", { ascending: true }),
    supabase.from("crypto_withdrawals").select(SELECT).in("status", ["completed", "rejected", "cancelled"]).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">طلبات السحب</h1>
        <p className="text-sm text-muted">
          المبلغ مجمّد من رصيد العميل منذ لحظة الطلب. اضغط &quot;بدء التنفيذ&quot; قبل الإرسال من المحفظة حتى لا يستطيع العميل الإلغاء، ثم أدخل TxID.
          الرفض يعيد المبلغ كاملاً لرصيد العميل.
        </p>
      </div>
      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">بانتظار التنفيذ ({(queue ?? []).length})</h2>
        {(queue ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات سحب معلقة.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {(queue as Withdrawal[]).map((w) => (
              <QueueCard key={w.id} w={w} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">آخر الطلبات المعالجة</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-muted">
                <th className="py-2 pe-3 text-start">التاريخ</th>
                <th className="py-2 pe-3 text-start">العميل</th>
                <th className="py-2 pe-3 text-start">الشبكة</th>
                <th className="py-2 pe-3 text-start">الصافي</th>
                <th className="py-2 pe-3 text-start">الحالة</th>
                <th className="py-2 pe-3 text-start">TxID / السبب</th>
              </tr>
            </thead>
            <tbody>
              {((recent ?? []) as Withdrawal[]).map((w) => {
                const profile = oneProfile(w.profiles);
                return (
                  <tr key={w.id} className="border-b border-border/60">
                    <td className="py-2 pe-3 text-xs text-muted">{new Date(w.created_at).toLocaleString("ar-EG")}</td>
                    <td className="py-2 pe-3">
                      <Link href={`/admin/users/${w.user_id}`} className="hover:underline">
                        {profile?.display_name ?? profile?.email}
                      </Link>
                    </td>
                    <td className="py-2 pe-3">{w.network}</td>
                    <td className="py-2 pe-3">{formatMoney(Number(w.net_amount), "ar")}</td>
                    <td className="py-2 pe-3">
                      <StatusChip status={w.status} />
                    </td>
                    <td className="py-2 pe-3 text-xs">
                      {w.tx_hash && isNetworkId(w.network) ? (
                        <a href={explorerTxUrl(w.network, w.tx_hash)} target="_blank" rel="noopener noreferrer" dir="ltr" className="font-mono text-accent hover:underline">
                          {shortAddress(displayTxHash(w.network, w.tx_hash), 10, 6)}
                        </a>
                      ) : (
                        <span className="text-muted">{w.reject_reason ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
