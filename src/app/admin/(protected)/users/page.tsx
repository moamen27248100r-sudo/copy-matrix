import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  real: "حقيقي",
  demo: "تجريبي",
};

// A user counts as "online" if they've had an active request within this
// window (last_seen_at is touched at most once per ~2min by middleware,
// see src/lib/supabase/middleware.ts, so this threshold has to be wider
// than that write cadence).
const ONLINE_WINDOW_MINUTES = 5;
// Registered but no real engagement beyond signup for this long, and never
// deposited -- distinct from someone who converted and is just quiet.
const ABANDONED_DAYS = 14;
// Absolute balance threshold for "high net value" -- a flat cutoff makes
// more sense than a percentile at this platform's current scale.
const VIP_BALANCE_THRESHOLD = 5000;

type StatusFilter =
  | "all"
  | "active_no_deposit"
  | "active_deposited"
  | "abandoned"
  | "kyc_verified_deposited"
  | "kyc_unverified"
  | "kyc_rejected"
  | "vip";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active_no_deposit", label: "نشط بدون إيداع" },
  { key: "active_deposited", label: "نشط ومودع" },
  { key: "abandoned", label: "مسجل وغير نشط" },
  { key: "kyc_verified_deposited", label: "موثّق ومودع" },
  { key: "kyc_unverified", label: "بدون توثيق" },
  { key: "kyc_rejected", label: "توثيق مرفوض" },
  { key: "vip", label: "عملاء VIP" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const { q, page: pageParam, status: statusParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const status: StatusFilter = STATUS_TABS.some((t) => t.key === statusParam) ? (statusParam as StatusFilter) : "all";

  const supabase = await createClient();

  // KYC + deposit status is tracked in separate tables, so resolve the
  // relevant id sets first and filter profiles by membership — this keeps
  // pagination correct for every tab instead of filtering a page of
  // results after the fact.
  const [{ data: approvedKyc }, { data: rejectedKyc }, { data: depositedUsers }] = await Promise.all([
    supabase.from("kyc_submissions").select("user_id").eq("status", "approved"),
    supabase.from("kyc_submissions").select("user_id").eq("status", "rejected"),
    supabase.from("wallet_transactions").select("user_id").eq("type", "deposit"),
  ]);
  const verifiedUserIds = new Set((approvedKyc ?? []).map((r) => r.user_id));
  const rejectedUserIds = new Set((rejectedKyc ?? []).map((r) => r.user_id));
  const depositedUserIds = new Set((depositedUsers ?? []).map((r) => r.user_id));
  const NONE = ["00000000-0000-0000-0000-000000000000"];

  let query = supabase
    .from("profiles")
    .select(
      "id, email, display_name, balance, is_admin, is_provider, is_suspended, account_type, created_at, country, last_seen_at, login_count",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const abandonedCutoff = new Date(Date.now() - ABANDONED_DAYS * 24 * 60 * 60 * 1000).toISOString();

  if (status === "active_no_deposit") {
    query = query.eq("is_suspended", false);
    query = query.not("id", "in", `(${(depositedUserIds.size > 0 ? [...depositedUserIds] : NONE).join(",")})`);
  }
  if (status === "active_deposited") {
    query = query.in("id", depositedUserIds.size > 0 ? [...depositedUserIds] : NONE);
  }
  if (status === "abandoned") {
    // Registered but never deposited, and no activity (or none logged
    // before this feature shipped) since the cutoff.
    query = query.not("id", "in", `(${(depositedUserIds.size > 0 ? [...depositedUserIds] : NONE).join(",")})`);
    query = query.or(`last_seen_at.is.null,last_seen_at.lt.${abandonedCutoff}`);
  }
  if (status === "kyc_verified_deposited") {
    const ids = [...verifiedUserIds].filter((id) => depositedUserIds.has(id));
    query = query.in("id", ids.length > 0 ? ids : NONE);
  }
  if (status === "kyc_unverified") {
    const excluded = new Set([...verifiedUserIds, ...rejectedUserIds]);
    if (excluded.size > 0) query = query.not("id", "in", `(${[...excluded].join(",")})`);
  }
  if (status === "kyc_rejected") {
    query = query.in("id", rejectedUserIds.size > 0 ? [...rejectedUserIds] : NONE);
  }
  if (status === "vip") {
    query = query.gte("balance", VIP_BALANCE_THRESHOLD);
  }

  query = query.range(from, to);

  const { data: users, count } = await query;
  const onlineCutoff = Date.now() - ONLINE_WINDOW_MINUTES * 60 * 1000;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const linkParams = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("status", status);
    params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) params.set(k, String(v));
    return params.toString();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">إدارة المستخدمين</h1>
        <span className="text-sm text-muted">{count ?? 0} مستخدم</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/users?${linkParams({ status: tab.key, page: 1 })}`}
            className={
              status === tab.key
                ? "rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground"
                : "rounded-full border border-border px-3.5 py-1.5 text-xs text-muted hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form className="flex gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          type="text"
          defaultValue={q ?? ""}
          placeholder="ابحث بالاسم أو الإيميل"
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border border-border bg-surface px-4 py-2 text-sm">
          بحث
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-muted">
              <th className="py-2">المستخدم</th>
              <th className="py-2">الرصيد</th>
              <th className="py-2">تاريخ الانضمام</th>
              <th className="py-2">الدولة</th>
              <th className="py-2">النشاط</th>
              <th className="py-2">التوثيق</th>
              <th className="py-2">الإيداع</th>
              <th className="py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-border/60">
                <td className="py-2 whitespace-nowrap">
                  <Link href={`/admin/users/${u.id}`} className="font-medium underline">
                    {u.display_name}
                  </Link>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="py-2 whitespace-nowrap">
                  ${Number(u.balance ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 whitespace-nowrap text-xs text-muted">
                  {new Date(u.created_at).toLocaleDateString("ar-EG")}
                </td>
                <td className="py-2 whitespace-nowrap text-xs text-muted">{u.country ?? "—"}</td>
                <td className="py-2 whitespace-nowrap text-xs">
                  {u.last_seen_at && new Date(u.last_seen_at).getTime() >= onlineCutoff ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> متصل الآن
                    </span>
                  ) : (
                    <span className="text-muted">
                      {u.last_seen_at
                        ? `آخر ظهور ${new Date(u.last_seen_at).toLocaleDateString("ar-EG")}`
                        : "لم يسجّل دخول"}
                    </span>
                  )}
                  <p className="text-muted">{u.login_count ?? 0} دخول</p>
                </td>
                <td className="py-2 whitespace-nowrap">
                  {verifiedUserIds.has(u.id) ? (
                    <span className="rounded border border-success/40 px-2 py-0.5 text-xs text-success">موثّق</span>
                  ) : (
                    <span className="rounded border border-border px-2 py-0.5 text-xs text-muted">غير موثّق</span>
                  )}
                </td>
                <td className="py-2 whitespace-nowrap">
                  {depositedUserIds.has(u.id) ? (
                    <span className="rounded border border-success/40 px-2 py-0.5 text-xs text-success">أودع</span>
                  ) : (
                    <span className="rounded border border-border px-2 py-0.5 text-xs text-muted">لم يودع</span>
                  )}
                </td>
                <td className="py-2 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded border border-border px-2 py-0.5 text-xs">
                      {ACCOUNT_TYPE_LABELS[u.account_type] ?? u.account_type}
                    </span>
                    {u.is_admin && <span className="rounded border border-border px-2 py-0.5 text-xs">أدمن</span>}
                    {u.is_provider && <span className="rounded border border-border px-2 py-0.5 text-xs">متداول</span>}
                    {u.is_suspended && (
                      <span className="rounded border border-danger/40 px-2 py-0.5 text-xs text-danger">معلّق</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(users ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted">لا يوجد نتائج.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link
            href={`/admin/users?${linkParams({ page: Math.max(1, page - 1) })}`}
            className={`rounded border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            السابق
          </Link>
          <span className="text-muted">
            صفحة {page} من {totalPages}
          </span>
          <Link
            href={`/admin/users?${linkParams({ page: Math.min(totalPages, page + 1) })}`}
            className={`rounded border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            التالي
          </Link>
        </div>
      )}
    </>
  );
}
