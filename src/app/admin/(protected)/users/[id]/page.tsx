import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  toggleAdmin,
  toggleSuspend,
  adjustBalance,
  addClientTrade,
  closeClientTrade,
  editClosedClientPosition,
} from "@/app/admin/actions";
import { SYMBOL_ICONS, symbolFullName } from "@/lib/symbol-icons";
import { MarginCallForm } from "@/components/MarginCallForm";

const SYMBOLS = Object.keys(SYMBOL_ICONS);

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  real: "حقيقي",
  demo: "تجريبي",
};

const KYC_STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

const WALLET_STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: kyc }, { data: walletHistory }, { data: subscriptions }, { data: positions }, { data: allProviders }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, phone, balance, is_admin, is_provider, is_suspended, account_type, created_at")
        .eq("id", id)
        .single(),
      supabase
        .from("kyc_submissions")
        .select("id, full_name, national_id_number, status, submitted_at, reviewed_at")
        .eq("user_id", id)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("wallet_requests")
        .select("id, type, amount, status, requested_at")
        .eq("user_id", id)
        .order("requested_at", { ascending: false })
        .limit(20),
      supabase
        .from("subscriptions")
        .select("id, provider_id, allocated_amount, is_active, created_at, providers(display_name)")
        .eq("follower_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("simulated_positions")
        .select("id, entry_price, exit_price, size, status, pnl, opened_at, signals(id, symbol, side, provider_id)")
        .eq("follower_id", id)
        .order("opened_at", { ascending: false })
        .limit(50),
      supabase.from("providers").select("id, display_name").order("display_name").limit(500),
    ]);

  if (!profile) {
    return (
      <>
        <Link href="/admin/users" className="text-sm underline">
          ← رجوع لقائمة المستخدمين
        </Link>
        <p className="text-sm text-muted">المستخدم غير موجود.</p>
      </>
    );
  }

  const isSelf = currentUser?.id === profile.id;

  const followedProviderIds = new Set((subscriptions ?? []).filter((s) => s.is_active).map((s) => s.provider_id));
  const followedProviders = (allProviders ?? []).filter((pr) => followedProviderIds.has(pr.id));
  const otherProviders = (allProviders ?? []).filter((pr) => !followedProviderIds.has(pr.id));

  return (
    <>
      <Link href="/admin/users" className="text-sm underline">
        ← رجوع لقائمة المستخدمين
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{profile.display_name}</h1>
          <p className="text-sm text-muted">{profile.email}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded border border-border px-2 py-0.5 text-xs">
            {ACCOUNT_TYPE_LABELS[profile.account_type] ?? profile.account_type}
          </span>
          {profile.is_admin && <span className="rounded border border-border px-2 py-0.5 text-xs">أدمن</span>}
          {profile.is_provider && <span className="rounded border border-border px-2 py-0.5 text-xs">متداول</span>}
          {profile.is_suspended && (
            <span className="rounded border border-danger/40 px-2 py-0.5 text-xs text-danger">معلّق</span>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-lg font-semibold">
            ${Number(profile.balance ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-muted">الرصيد الحالي</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-lg font-semibold">{new Date(profile.created_at).toLocaleDateString("ar-EG")}</p>
          <p className="text-xs text-muted">تاريخ الانضمام</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-lg font-semibold">{profile.phone ?? "—"}</p>
          <p className="text-xs text-muted">رقم الهاتف</p>
        </div>
      </section>

      {!isSelf && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">إجراءات الحساب</h2>
          <div className="flex flex-wrap gap-3">
            <form action={toggleAdmin}>
              <input type="hidden" name="userId" value={profile.id} />
              <input type="hidden" name="nextValue" value={(!profile.is_admin).toString()} />
              <input type="hidden" name="returnTo" value={`/admin/users/${profile.id}`} />
              <button type="submit" className="rounded border border-border px-3 py-1.5 text-sm">
                {profile.is_admin ? "إزالة صلاحية الأدمن" : "تعيين كأدمن"}
              </button>
            </form>
            <form action={toggleSuspend}>
              <input type="hidden" name="userId" value={profile.id} />
              <input type="hidden" name="nextValue" value={(!profile.is_suspended).toString()} />
              <input type="hidden" name="returnTo" value={`/admin/users/${profile.id}`} />
              <button
                type="submit"
                className={
                  profile.is_suspended
                    ? "rounded border border-success/40 px-3 py-1.5 text-sm text-success"
                    : "rounded border border-danger/40 px-3 py-1.5 text-sm text-danger"
                }
              >
                {profile.is_suspended ? "إلغاء التعليق" : "تعليق الحساب"}
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">تعديل الرصيد يدويًا</h2>
        <p className="text-xs text-muted">
          استخدمها لتصحيح رصيد خاطئ فقط. أي تعديل هنا يتسجل في سجل الإجراءات وفي سجل معاملات المستخدم نفسه.
        </p>
        <form action={adjustBalance} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="userId" value={profile.id} />
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
            القيمة (استخدم سالب للخصم)
            <input
              name="delta"
              type="number"
              step="0.01"
              required
              placeholder="مثال: 50 أو -50-"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-[2] flex-col gap-1 text-xs text-muted">
            السبب (إلزامي)
            <input
              name="reason"
              type="text"
              required
              placeholder="مثال: تصحيح خطأ في رصيد تجريبي"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
          >
            تطبيق التعديل
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">طلبات التوثيق</h2>
        {(kyc ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات توثيق.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {kyc!.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
                <div>
                  <p>{k.full_name}</p>
                  <p className="text-xs text-muted">
                    {new Date(k.submitted_at).toLocaleDateString("ar-EG")} · رقم الهوية: {k.national_id_number}
                  </p>
                </div>
                <span className="rounded border border-border px-2 py-0.5 text-xs">
                  {KYC_STATUS_LABELS[k.status] ?? k.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">طلبات الإيداع والسحب</h2>
        {(walletHistory ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات محفظة.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {walletHistory!.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
                <div>
                  <p>
                    {w.type === "deposit" ? "إيداع" : "سحب"} — ${Number(w.amount).toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-muted">{new Date(w.requested_at).toLocaleDateString("ar-EG")}</p>
                </div>
                <span className="rounded border border-border px-2 py-0.5 text-xs">
                  {WALLET_STATUS_LABELS[w.status] ?? w.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">اشتراكات النسخ</h2>
        {(subscriptions ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا يتابع/ينسخ أي متداول حاليًا.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {subscriptions!.map((s) => {
              const provider = Array.isArray(s.providers) ? s.providers[0] : s.providers;
              return (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-sm">
                  <div>
                    <p>{provider?.display_name ?? "—"}</p>
                    <p className="text-xs text-muted">
                      ${Number(s.allocated_amount ?? 0).toLocaleString("en-US")} منذ{" "}
                      {new Date(s.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span
                    className={
                      s.is_active
                        ? "rounded border border-success/40 px-2 py-0.5 text-xs text-success"
                        : "rounded border border-border px-2 py-0.5 text-xs text-muted"
                    }
                  >
                    {s.is_active ? "نشط" : "متوقف"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">صفقات العميل</h2>
        <p className="text-xs text-muted">
          صفقات فردية خاصة بهذا العميل وحده — ما تعمله هنا ميأثرش على أي عميل تاني حتى لو بيتابع نفس المتداول.
        </p>

        {(positions ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد صفقات لهذا العميل.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {positions!.map((p) => {
              const signal = Array.isArray(p.signals) ? p.signals[0] : p.signals;
              return (
                <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {signal?.symbol ?? "—"} · {signal?.side === "buy" ? "شراء" : "بيع"} · دخول {p.entry_price} · حجم $
                      {Number(p.size).toLocaleString("en-US")}
                    </span>
                    <span
                      className={
                        p.status === "open"
                          ? "rounded border border-warning/40 px-2 py-0.5 text-xs text-warning"
                          : Number(p.pnl ?? 0) >= 0
                            ? "rounded border border-success/40 px-2 py-0.5 text-xs text-success"
                            : "rounded border border-danger/40 px-2 py-0.5 text-xs text-danger"
                      }
                    >
                      {p.status === "open" ? "مفتوحة" : `مغلقة (${Number(p.pnl ?? 0) >= 0 ? "+" : ""}${Number(p.pnl ?? 0).toFixed(2)}$)`}
                    </span>
                  </div>

                  {p.status === "open" ? (
                    <form action={closeClientTrade} className="flex items-center gap-2">
                      <input type="hidden" name="signalId" value={signal?.id} />
                      <input type="hidden" name="followerId" value={id} />
                      <input
                        name="exitPrice"
                        type="number"
                        step="any"
                        required
                        placeholder="سعر الإغلاق"
                        className="w-32 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                      />
                      <button type="submit" className="rounded border border-border px-2 py-1 text-xs">
                        إغلاق الصفقة
                      </button>
                    </form>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-xs text-muted">تعديل سعر الإغلاق</summary>
                      <form action={editClosedClientPosition} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="positionId" value={p.id} />
                        <input type="hidden" name="followerId" value={id} />
                        <input
                          name="newExitPrice"
                          type="number"
                          step="any"
                          required
                          defaultValue={p.exit_price ?? undefined}
                          className="w-32 rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                        <button type="submit" className="rounded border border-border px-2 py-1 text-xs">
                          حفظ التعديل
                        </button>
                      </form>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">+ صفقة فردية جديدة</summary>
          <form action={addClientTrade} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="followerId" value={id} />
            <select name="providerId" required className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
              <option value="">اختر المتداول المنسوب له</option>
              {(allProviders ?? []).map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.display_name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select name="symbol" required className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                {SYMBOLS.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym} — {symbolFullName(sym)}
                  </option>
                ))}
              </select>
              <select name="side" required className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                <option value="buy">شراء</option>
                <option value="sell">بيع</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-muted">
                سعر الدخول
                <input name="entryPrice" type="number" step="any" required className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                حجم الصفقة ($)
                <input name="size" type="number" step="any" required className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </label>
            </div>
            <button
              type="submit"
              className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
            >
              إنشاء الصفقة
            </button>
          </form>
        </details>

        <details className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium">🎯 صفقة خسارة واقعية (مارجن كول)</summary>
          <p className="mt-2 text-xs text-muted">
            بتحسب كل حاجة زي MT5: بتاخد آخر سعرين حقيقيين لنفس الرمز على المنصة عشان تعرف اتجاه السوق، تختار جهة
            (شراء/بيع) تخسر لو الاتجاه استمر، وتحسب حجم اللوت فعليًا من رصيد العميل وعدد النقاط. مش محتاج تكتب أسعار
            بنفسك.
          </p>
          <MarginCallForm
            followerId={id}
            balance={Number(profile.balance ?? 0)}
            followedProviders={followedProviders}
            otherProviders={otherProviders}
            symbols={SYMBOLS}
          />
        </details>
      </section>
    </>
  );
}
