import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  approveKyc,
  rejectKyc,
  approveWalletRequest,
  rejectWalletRequest,
  toggleAdmin,
  toggleSuspend,
  createLeader,
  updateLeader,
  deleteLeader,
} from "@/app/admin/actions";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";
import { ConfirmButton } from "@/components/ConfirmButton";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  real: "حقيقي",
  demo: "تجريبي",
};

export default async function AdminPage({
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
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/admin/login?error=" + encodeURIComponent("هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة."));
  }

  const [
    { data: submissions },
    { data: walletRequests },
    { data: users },
    { count: userCount },
    { count: providerCount },
    { count: pendingKycCount },
    { count: pendingWalletCount },
    { count: signalCount },
    { count: positionCount },
    { data: balances },
    { data: deposits },
    { data: withdrawals },
    { data: leaders },
    { data: leaderCards },
  ] = await Promise.all([
    supabase
      .from("kyc_submissions")
      .select("id, full_name, national_id_number, id_document_path, address_proof_path, status, submitted_at")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("wallet_requests")
      .select("id, user_id, type, amount, status, requested_at, profiles(display_name, email)")
      .eq("status", "pending")
      .order("requested_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, email, display_name, balance, is_admin, is_provider, is_suspended, account_type, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("providers").select("id", { count: "exact", head: true }),
    supabase.from("kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("wallet_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("signals").select("id", { count: "exact", head: true }),
    supabase.from("simulated_positions").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("balance"),
    supabase.from("wallet_transactions").select("amount").eq("type", "deposit"),
    supabase.from("wallet_transactions").select("amount").eq("type", "withdrawal"),
    supabase
      .from("providers")
      .select("id, display_name, bio, skill, min_copy_amount, base_followers_count, total_profit, total_withdrawals, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("provider_cards")
      .select("provider_id, followers_count, win_rate_pct, avg_return_pct, tier, rating_score")
      .limit(150),
  ]);

  const leaderCardById = new Map((leaderCards ?? []).map((c) => [c.provider_id, c]));
  const leaderRows = (leaders ?? []).map((l) => ({ ...l, card: leaderCardById.get(l.id) }));

  const withUrls = await Promise.all(
    (submissions ?? []).map(async (s) => {
      const { data: idUrl } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(s.id_document_path, 60 * 10);
      const addressUrl = s.address_proof_path
        ? (
            await supabase.storage
              .from("kyc-documents")
              .createSignedUrl(s.address_proof_path, 60 * 10)
          ).data
        : null;
      return { ...s, idDocumentUrl: idUrl?.signedUrl, addressProofUrl: addressUrl?.signedUrl };
    }),
  );

  const totalBalance = (balances ?? []).reduce((sum, p) => sum + Number(p.balance ?? 0), 0);
  const totalDeposits = (deposits ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const totalWithdrawals = Math.abs(
    (withdrawals ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0),
  );

  const stats = [
    { label: "إجمالي المستخدمين", value: userCount ?? 0 },
    { label: "إجمالي المتداولين", value: providerCount ?? 0 },
    { label: "طلبات توثيق معلقة", value: pendingKycCount ?? 0 },
    { label: "طلبات محفظة معلقة", value: pendingWalletCount ?? 0 },
    { label: "إجمالي الصفقات", value: signalCount ?? 0 },
    { label: "صفقات منسوخة", value: positionCount ?? 0 },
    { label: "رصيد المنصة الكلي", value: `$${totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
    { label: "إجمالي الإيداعات", value: `$${totalDeposits.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
    { label: "إجمالي السحوبات", value: `$${totalWithdrawals.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
  ];

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
        <BackButton fallbackHref="/dashboard" />
        <h1 className="text-2xl font-semibold">لوحة الإدارة</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">إحصائيات المنصة</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-surface p-3 text-center">
                <p className="text-lg font-semibold">{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">إدارة المستخدمين</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2">المستخدم</th>
                  <th className="py-2">الرصيد</th>
                  <th className="py-2">تاريخ الانضمام</th>
                  <th className="py-2">الحالة</th>
                  <th className="py-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="py-2 whitespace-nowrap">
                      <p className="font-medium">{u.display_name}</p>
                      <p className="text-xs text-muted">{u.email}</p>
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      ${Number(u.balance ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 whitespace-nowrap text-xs text-muted">
                      {new Date(u.created_at).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded border border-border px-2 py-0.5 text-xs">
                          {ACCOUNT_TYPE_LABELS[u.account_type] ?? u.account_type}
                        </span>
                        {u.is_admin && (
                          <span className="rounded border border-border px-2 py-0.5 text-xs">أدمن</span>
                        )}
                        {u.is_provider && (
                          <span className="rounded border border-border px-2 py-0.5 text-xs">متداول</span>
                        )}
                        {u.is_suspended && (
                          <span className="rounded border border-danger/40 px-2 py-0.5 text-xs text-danger">
                            معلّق
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {u.id === user.id ? (
                        <span className="text-xs text-muted">حسابك</span>
                      ) : (
                        <div className="flex gap-2">
                          <form action={toggleAdmin}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="nextValue" value={(!u.is_admin).toString()} />
                            <button type="submit" className="rounded border border-border px-2 py-1 text-xs">
                              {u.is_admin ? "إزالة الأدمن" : "تعيين كأدمن"}
                            </button>
                          </form>
                          <form action={toggleSuspend}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="nextValue" value={(!u.is_suspended).toString()} />
                            <button
                              type="submit"
                              className={
                                u.is_suspended
                                  ? "rounded border border-success/40 px-2 py-1 text-xs text-success"
                                  : "rounded border border-danger/40 px-2 py-1 text-xs text-danger"
                              }
                            >
                              {u.is_suspended ? "إلغاء التعليق" : "تعليق الحساب"}
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">إدارة المتداولين</h2>
            <span className="text-xs text-muted">{leaderRows.length} متداول</span>
          </div>

          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">+ إضافة متداول جديد</summary>
            <form action={createLeader} className="mt-4 flex flex-col gap-3">
              <input
                name="displayName"
                type="text"
                placeholder="اسم المتداول"
                required
                className="rounded border border-border bg-background px-3 py-2 text-sm"
              />
              <textarea
                name="bio"
                placeholder="نبذة تعريفية (اختياري)"
                rows={2}
                className="rounded border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                  نسبة النجاح المستهدفة %
                  <input
                    name="skill"
                    type="number"
                    min={30}
                    max={85}
                    defaultValue={55}
                    className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  الحد الأدنى للنسخ ($)
                  <input
                    name="minCopyAmount"
                    type="number"
                    min={1}
                    defaultValue={50}
                    className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  عدد المتابعين الابتدائي
                  <input
                    name="baseFollowers"
                    type="number"
                    min={0}
                    defaultValue={0}
                    className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
              >
                إنشاء المتداول
              </button>
            </form>
          </details>

          {leaderRows.length === 0 ? (
            <p className="text-sm text-muted">لا يوجد متداولون حتى الآن.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {leaderRows.map((l) => (
                <details key={l.id} className="rounded-lg border border-border bg-surface p-4">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{l.display_name}</span>
                    <span className="flex flex-wrap gap-1.5 text-xs text-muted">
                      <span className="rounded border border-border px-2 py-0.5">{l.card?.tier ?? "—"}</span>
                      <span className="rounded border border-border px-2 py-0.5">
                        تقييم {l.card?.rating_score ?? "—"}
                      </span>
                      <span className="rounded border border-border px-2 py-0.5">
                        {l.card?.followers_count ?? 0} متابع
                      </span>
                      <span className="rounded border border-border px-2 py-0.5">
                        نجاح {l.card?.win_rate_pct != null ? `${l.card.win_rate_pct}%` : "—"}
                      </span>
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-3">
                    <form action={updateLeader} className="flex flex-col gap-3">
                      <input type="hidden" name="providerId" value={l.id} />
                      <input
                        name="displayName"
                        type="text"
                        defaultValue={l.display_name ?? ""}
                        required
                        className="rounded border border-border bg-background px-3 py-2 text-sm"
                      />
                      <textarea
                        name="bio"
                        defaultValue={l.bio ?? ""}
                        rows={2}
                        className="rounded border border-border bg-background px-3 py-2 text-sm"
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <label className="flex flex-col gap-1 text-xs text-muted">
                          نسبة النجاح المستهدفة %
                          <input
                            name="skill"
                            type="number"
                            min={30}
                            max={85}
                            defaultValue={Math.round(Number(l.skill) * 100)}
                            className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted">
                          الحد الأدنى للنسخ ($)
                          <input
                            name="minCopyAmount"
                            type="number"
                            min={1}
                            defaultValue={l.min_copy_amount}
                            className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted">
                          عدد المتابعين الابتدائي
                          <input
                            name="baseFollowers"
                            type="number"
                            min={0}
                            defaultValue={l.base_followers_count}
                            className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
                        >
                          حفظ التعديلات
                        </button>
                      </div>
                    </form>
                    <form action={deleteLeader}>
                      <input type="hidden" name="providerId" value={l.id} />
                      <ConfirmButton
                        confirmText={`هل تريد حذف "${l.display_name}"؟ سيتم حذف كل صفقاته وسجله نهائيًا ولن يتمكن أي مستخدم من نسخه بعد ذلك.`}
                        className="rounded border border-danger/40 px-4 py-1.5 text-sm text-danger"
                      >
                        حذف المتداول
                      </ConfirmButton>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">مراجعة طلبات التوثيق</h2>
          {withUrls.length === 0 ? (
            <p className="text-sm text-muted">لا توجد طلبات توثيق حتى الآن.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {withUrls.map((s) => (
                <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-xs text-muted">رقم الهوية: {s.national_id_number}</p>
                      <p className="text-xs text-muted">
                        تاريخ التقديم: {new Date(s.submitted_at).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                    <span className="rounded border border-border px-2 py-1 text-xs">
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    {s.idDocumentUrl && (
                      <a href={s.idDocumentUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                        عرض إثبات الهوية
                      </a>
                    )}
                    {s.addressProofUrl && (
                      <a
                        href={s.addressProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline"
                      >
                        عرض إثبات العنوان
                      </a>
                    )}
                  </div>

                  {s.status === "pending" && (
                    <div className="flex gap-3">
                      <form action={approveKyc}>
                        <input type="hidden" name="submissionId" value={s.id} />
                        <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover">
                          قبول
                        </button>
                      </form>
                      <form action={rejectKyc}>
                        <input type="hidden" name="submissionId" value={s.id} />
                        <button type="submit" className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger">
                          رفض
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">مراجعة طلبات الإيداع والسحب</h2>
          {(walletRequests ?? []).length === 0 ? (
            <p className="text-sm text-muted">لا توجد طلبات معلقة حاليًا.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {walletRequests!.map((r) => {
                const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {r.type === "deposit" ? "طلب إيداع" : "طلب سحب"} — $
                        {Number(r.amount).toLocaleString("en-US")}
                      </p>
                      <p className="text-xs text-muted">
                        {profile?.display_name} · {profile?.email}
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(r.requested_at).toLocaleDateString("ar-EG")}
                      </p>
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
      </main>
    </>
  );
}
