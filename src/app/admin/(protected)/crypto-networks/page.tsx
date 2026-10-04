import { createClient } from "@/lib/supabase/server";
import { updateCryptoNetwork } from "@/app/admin/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { CHAINS, estimatedMinutes, isNetworkId, networkLabel } from "@/lib/crypto/networks";

export default async function AdminCryptoNetworksPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const { data: networks } = await supabase.from("crypto_networks").select("*").order("sort_order");
  const field = "flex flex-col gap-1 text-xs text-muted";
  const input = "rounded border border-border bg-background px-3 py-2 text-sm text-foreground";

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">إعدادات الإيداع والسحب (USDT)</h1>
        <p className="text-sm text-muted">
          الشبكة التي ليس لها عنوان إيداع لا تظهر للعميل في صفحة الإيداع. لو لم تتوفر أي شبكة تظهر للعميل رسالة &quot;الإيداع غير متاح مؤقتاً&quot;.
          التغييرات تُطبّق فوراً على الطلبات الجديدة.
        </p>
      </div>

      {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {saved && <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">تم حفظ إعدادات {saved}.</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        {(networks ?? []).filter((n) => isNetworkId(n.id)).map((n) => {
          const id = n.id as keyof typeof CHAINS;
          const visible = n.deposit_enabled && !!n.deposit_address;
          return (
            <form key={n.id} action={updateCryptoNetwork} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <input type="hidden" name="id" value={n.id} />
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{networkLabel(id)}</p>
                <span className={`rounded border px-2 py-0.5 text-xs ${visible ? "border-success/40 text-success" : "border-warning/40 text-warning"}`}>
                  {visible ? "ظاهرة للإيداع" : "مخفية عن الإيداع"}
                </span>
              </div>
              <p className="text-[11px] text-muted" dir="ltr">
                USDT contract: {CHAINS[id].usdtContract}
              </p>

              <label className={field}>
                عنوان الإيداع
                <input name="depositAddress" defaultValue={n.deposit_address ?? ""} dir="ltr" placeholder={id === "TRC20" ? "T…" : "0x…"} className={`${input} font-mono`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={field}>
                  الحد الأدنى للإيداع (USDT)
                  <input name="minDeposit" type="number" step="any" min="0.000001" required defaultValue={n.min_deposit} className={input} />
                </label>
                <label className={field}>
                  التأكيدات المطلوبة
                  <input name="confirmations" type="number" step="1" min="1" max="500" required defaultValue={n.confirmations} className={input} />
                  <span>≈ {estimatedMinutes(id, n.confirmations)} دقيقة</span>
                </label>
                <label className={field}>
                  رسوم السحب الثابتة (USDT)
                  <input name="withdrawFee" type="number" step="any" min="0" required defaultValue={n.withdraw_fee} className={input} />
                </label>
                <label className={field}>
                  الحد الأدنى للسحب (USDT)
                  <input name="minWithdraw" type="number" step="any" min="0.000001" required defaultValue={n.min_withdraw} className={input} />
                </label>
                <label className={`${field} col-span-2`}>
                  الحد اليومي للسحب لكل عميل (آخر 24 ساعة، USDT)
                  <input name="dailyWithdrawLimit" type="number" step="any" min="0.000001" required defaultValue={n.daily_withdraw_limit} className={input} />
                </label>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="depositEnabled" defaultChecked={n.deposit_enabled} className="h-4 w-4 accent-accent" />
                  تفعيل الإيداع
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="withdrawEnabled" defaultChecked={n.withdraw_enabled} className="h-4 w-4 accent-accent" />
                  تفعيل السحب
                </label>
              </div>
              <SubmitButton className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50">
                حفظ {n.id}
              </SubmitButton>
              {n.updated_at && <p className="text-[11px] text-muted">آخر تعديل: {new Date(n.updated_at).toLocaleString("ar-EG")}</p>}
            </form>
          );
        })}
      </div>
    </>
  );
}
