import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  real: "حقيقي",
  demo: "تجريبي",
};

type CopyFilter = "all" | "copying" | "not_copying";

const COPY_TABS: { key: CopyFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "copying", label: "بينسخ" },
  { key: "not_copying", label: "لا ينسخ" },
];

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { page: pageParam, filter: filterParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const filter: CopyFilter = COPY_TABS.some((t) => t.key === filterParam) ? (filterParam as CopyFilter) : "all";

  const supabase = await createClient();

  // Every client who is actively copying someone right now, regardless of
  // which page of clients we're looking at — needed to know who to
  // include/exclude for the "بينسخ" / "لا ينسخ" filter before pagination.
  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("follower_id, allocated_amount, created_at, providers(display_name)")
    .eq("is_active", true);

  const subByFollower = new Map(
    (activeSubs ?? []).map((s) => [
      s.follower_id,
      {
        providerName: (Array.isArray(s.providers) ? s.providers[0] : s.providers)?.display_name ?? "—",
        amount: Number(s.allocated_amount ?? 0),
        since: s.created_at as string,
      },
    ]),
  );
  const copyingIds = [...subByFollower.keys()];

  let query = supabase
    .from("profiles")
    .select("id, display_name, email, account_type, created_at", { count: "exact" })
    .eq("is_admin", false)
    .eq("is_provider", false)
    .order("created_at", { ascending: false });

  if (filter === "copying") {
    query = query.in("id", copyingIds.length > 0 ? copyingIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (filter === "not_copying" && copyingIds.length > 0) {
    query = query.not("id", "in", `(${copyingIds.join(",")})`);
  }

  query = query.range(from, to);

  const { data: clients, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const linkParams = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    params.set("filter", filter);
    params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) params.set(k, String(v));
    return params.toString();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">نشاط النسخ</h1>
        <span className="text-sm text-muted">{count ?? 0} عميل</span>
      </div>
      <p className="text-xs text-muted">كل عميل مسجّل على المنصة (تجريبي أو حقيقي)، وهل ينسخ متداولًا حاليًا أم لا.</p>

      <div className="flex flex-wrap gap-2">
        {COPY_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/subscriptions?${linkParams({ filter: tab.key, page: 1 })}`}
            className={
              filter === tab.key
                ? "rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground"
                : "rounded-full border border-border px-3.5 py-1.5 text-xs text-muted hover:text-foreground"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-muted">
              <th className="py-2">العميل</th>
              <th className="py-2">نوع الحساب</th>
              <th className="py-2">تاريخ التسجيل</th>
              <th className="py-2">حالة النسخ</th>
              <th className="py-2">المتداول المنسوخ</th>
              <th className="py-2">المبلغ المخصص</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => {
              const sub = subByFollower.get(c.id);
              return (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2 whitespace-nowrap">
                    <Link href={`/admin/users/${c.id}`} className="underline">
                      {c.display_name ?? "—"}
                    </Link>
                    <p className="text-xs text-muted">{c.email}</p>
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <span className="rounded border border-border px-2 py-0.5 text-xs">
                      {ACCOUNT_TYPE_LABELS[c.account_type] ?? c.account_type}
                    </span>
                  </td>
                  <td className="py-2 whitespace-nowrap text-xs text-muted">
                    {new Date(c.created_at).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {sub ? (
                      <span className="rounded border border-success/40 px-2 py-0.5 text-xs text-success">بينسخ</span>
                    ) : (
                      <span className="rounded border border-border px-2 py-0.5 text-xs text-muted">لا ينسخ</span>
                    )}
                  </td>
                  <td className="py-2 whitespace-nowrap">{sub?.providerName ?? "—"}</td>
                  <td className="py-2 whitespace-nowrap">
                    {sub ? `$${sub.amount.toLocaleString("en-US")}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(clients ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted">لا يوجد نتائج.</p>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link
            href={`/admin/subscriptions?${linkParams({ page: Math.max(1, page - 1) })}`}
            className={`rounded border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            السابق
          </Link>
          <span className="text-muted">
            صفحة {page} من {totalPages}
          </span>
          <Link
            href={`/admin/subscriptions?${linkParams({ page: Math.min(totalPages, page + 1) })}`}
            className={`rounded border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            التالي
          </Link>
        </div>
      )}
    </>
  );
}
