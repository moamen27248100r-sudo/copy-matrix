import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { becomeProvider, publishSignal, closeSignal } from "@/app/provider/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function ProviderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: provider } = await supabase
    .from("providers")
    .select("id, bio")
    .eq("user_id", user.id)
    .single();

  if (!provider) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">أصبح متداولًا</h1>
          <ThemeToggle />
        </div>
        <p className="text-sm text-muted">
          أنشئ ملفك التعريفي كمتداول ليتمكن المستخدمون من متابعتك ونسخ صفقاتك تلقائيًا.
        </p>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form action={becomeProvider} className="flex flex-col gap-3">
          <textarea
            name="bio"
            placeholder="نبذة مختصرة عنك وعن أسلوبك في التداول"
            rows={4}
            className="rounded border border-border bg-surface px-3 py-2"
          />
          <button type="submit" className="rounded bg-brand px-3 py-2 text-brand-foreground">
            نشر الملف التعريفي كمتداول
          </button>
        </form>

        <Link href="/dashboard" className="text-sm underline">
          العودة إلى لوحة التحكم
        </Link>
      </main>
    );
  }

  const { data: signals } = await supabase
    .from("signals")
    .select("id, symbol, side, entry_price, stop_loss, take_profit, exit_price, status, opened_at, closed_at")
    .eq("provider_id", provider.id)
    .order("opened_at", { ascending: false });

  const openSignals = (signals ?? []).filter((s) => s.status === "open");
  const closedSignals = (signals ?? []).filter((s) => s.status === "closed");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">لوحة المتداول</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="underline">
            لوحة التحكم
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">نشر صفقة جديدة</h2>
        <form action={publishSignal} className="grid grid-cols-2 gap-3">
          <input
            name="symbol"
            placeholder="الرمز (مثال: BTCUSDT)"
            required
            className="col-span-2 rounded border border-border bg-background px-3 py-2 sm:col-span-1"
          />
          <select
            name="side"
            required
            className="rounded border border-border bg-background px-3 py-2"
          >
            <option value="buy">شراء</option>
            <option value="sell">بيع</option>
          </select>
          <input
            name="entryPrice"
            type="number"
            step="any"
            placeholder="سعر الدخول"
            required
            className="rounded border border-border bg-background px-3 py-2"
          />
          <input
            name="stopLoss"
            type="number"
            step="any"
            placeholder="وقف الخسارة (اختياري)"
            className="rounded border border-border bg-background px-3 py-2"
          />
          <input
            name="takeProfit"
            type="number"
            step="any"
            placeholder="جني الأرباح (اختياري)"
            className="rounded border border-border bg-background px-3 py-2"
          />
          <button
            type="submit"
            className="col-span-2 rounded bg-brand px-3 py-2 text-brand-foreground"
          >
            نشر الصفقة
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">الصفقات المفتوحة</h2>
        {openSignals.length === 0 ? (
          <p className="text-sm text-muted">لا توجد صفقات مفتوحة حاليًا.</p>
        ) : (
          openSignals.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <span className="font-medium">{s.symbol}</span>{" "}
                <span className={s.side === "buy" ? "text-success" : "text-danger"}>
                  {s.side === "buy" ? "شراء" : "بيع"}
                </span>{" "}
                عند {s.entry_price}
              </div>
              <form action={closeSignal} className="flex items-center gap-2">
                <input type="hidden" name="signalId" value={s.id} />
                <input
                  name="exitPrice"
                  type="number"
                  step="any"
                  placeholder="سعر الإغلاق"
                  required
                  className="w-32 rounded border border-border bg-background px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  className="rounded border border-border px-3 py-1 text-sm"
                >
                  إغلاق
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">الصفقات المغلقة</h2>
        {closedSignals.length === 0 ? (
          <p className="text-sm text-muted">لم يتم إغلاق أي صفقة حتى الآن.</p>
        ) : (
          closedSignals.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm"
            >
              <span>
                <span className="font-medium">{s.symbol}</span>{" "}
                {s.side === "buy" ? "شراء" : "بيع"} من {s.entry_price} إلى {s.exit_price}
              </span>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
