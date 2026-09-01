import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  real: "حقيقي",
  demo: "تجريبي",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, email, display_name, balance, is_admin, is_provider, is_suspended, account_type, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: users, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">إدارة المستخدمين</h1>
        <span className="text-sm text-muted">{count ?? 0} مستخدم</span>
      </div>

      <form className="flex gap-2">
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
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-muted">
              <th className="py-2">المستخدم</th>
              <th className="py-2">الرصيد</th>
              <th className="py-2">تاريخ الانضمام</th>
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
            href={`/admin/users?q=${encodeURIComponent(q ?? "")}&page=${Math.max(1, page - 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            السابق
          </Link>
          <span className="text-muted">
            صفحة {page} من {totalPages}
          </span>
          <Link
            href={`/admin/users?q=${encodeURIComponent(q ?? "")}&page=${Math.min(totalPages, page + 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            التالي
          </Link>
        </div>
      )}
    </>
  );
}
