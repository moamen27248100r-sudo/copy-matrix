import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data: subscriptions, count } = await supabase
    .from("subscriptions")
    .select("id, allocated_amount, is_active, created_at, follower_id, profiles(display_name, email), providers(display_name)", {
      count: "exact",
    })
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">نشاط النسخ</h1>
        <span className="text-sm text-muted">{count ?? 0} اشتراك نشط</span>
      </div>
      <p className="text-xs text-muted">كل مستخدم بينسخ متداول معيّن دلوقتي، والمبلغ المخصص لكل نسخة.</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-muted">
              <th className="py-2">الناسخ</th>
              <th className="py-2">المتداول المنسوخ</th>
              <th className="py-2">المبلغ المخصص</th>
              <th className="py-2">تاريخ البدء</th>
            </tr>
          </thead>
          <tbody>
            {(subscriptions ?? []).map((s) => {
              const follower = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
              const provider = Array.isArray(s.providers) ? s.providers[0] : s.providers;
              return (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="py-2 whitespace-nowrap">
                    <Link href={`/admin/users/${s.follower_id}`} className="underline">
                      {follower?.display_name ?? "—"}
                    </Link>
                    <p className="text-xs text-muted">{follower?.email}</p>
                  </td>
                  <td className="py-2 whitespace-nowrap">{provider?.display_name ?? "—"}</td>
                  <td className="py-2 whitespace-nowrap">
                    ${Number(s.allocated_amount ?? 0).toLocaleString("en-US")}
                  </td>
                  <td className="py-2 whitespace-nowrap text-xs text-muted">
                    {new Date(s.created_at).toLocaleDateString("ar-EG")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(subscriptions ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-muted">لا يوجد أي اشتراك نسخ نشط حاليًا.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link
            href={`/admin/subscriptions?page=${Math.max(1, page - 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            السابق
          </Link>
          <span className="text-muted">
            صفحة {page} من {totalPages}
          </span>
          <Link
            href={`/admin/subscriptions?page=${Math.min(totalPages, page + 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            التالي
          </Link>
        </div>
      )}
    </>
  );
}
