import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { followProvider, unfollowProvider } from "@/app/discover/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

const SORT_OPTIONS = {
  return: { column: "avg_return_pct", ascending: false },
  followers: { column: "followers_count", ascending: false },
  winrate: { column: "win_rate_pct", ascending: false },
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q, sort } = await searchParams;
  const sortKey: SortKey = sort && sort in SORT_OPTIONS ? (sort as SortKey) : "return";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let providersQuery = supabase.from("provider_cards").select("*");
  if (q) {
    providersQuery = providersQuery.ilike("display_name", `%${q}%`);
  }
  const { column, ascending } = SORT_OPTIONS[sortKey];
  providersQuery = providersQuery.order(column, { ascending, nullsFirst: false });

  const [{ data: providers }, { data: mySubscriptions }] = await Promise.all([
    providersQuery,
    supabase
      .from("subscriptions")
      .select("provider_id")
      .eq("follower_id", user.id)
      .eq("is_active", true),
  ]);

  const followingIds = new Set(
    (mySubscriptions ?? []).map((s) => s.provider_id),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">اكتشاف المتداولين</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/portfolio" className="underline">
            محفظتي
          </Link>
          <Link href="/dashboard" className="underline">
            لوحة التحكم
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          defaultValue={q}
          placeholder="ابحث عن متداول بالاسم"
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm"
        />
        <select
          name="sort"
          defaultValue={sortKey}
          className="rounded border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="return">الأعلى عائدًا</option>
          <option value="followers">الأكثر متابعة</option>
          <option value="winrate">الأعلى نسبة نجاح</option>
        </select>
        <button type="submit" className="rounded bg-brand px-4 py-2 text-sm text-brand-foreground">
          بحث
        </button>
      </form>

      {!providers || providers.length === 0 ? (
        <p className="text-sm text-muted">
          لا يوجد متداولون مطابقون لبحثك.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {providers.map((p) => {
            const isFollowing = followingIds.has(p.provider_id);
            return (
              <div
                key={p.provider_id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <Link href={`/trader/${p.provider_id}`} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm text-brand-foreground">
                    {p.display_name?.charAt(0) ?? "؟"}
                  </div>
                  <div>
                    <p className="font-medium underline-offset-2 hover:underline">{p.display_name}</p>
                    <p className="text-xs text-muted">
                      {p.followers_count} ناسخ
                    </p>
                  </div>
                </Link>

                {p.bio && (
                  <p className="text-sm text-muted">{p.bio}</p>
                )}

                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="font-semibold">
                      {p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}
                    </p>
                    <p className="text-xs text-muted">نسبة النجاح</p>
                  </div>
                  <div>
                    <p
                      className={
                        p.avg_return_pct != null && p.avg_return_pct < 0
                          ? "font-semibold text-danger"
                          : "font-semibold text-success"
                      }
                    >
                      {p.avg_return_pct != null ? `${p.avg_return_pct}%` : "—"}
                    </p>
                    <p className="text-xs text-muted">متوسط العائد</p>
                  </div>
                  <div>
                    <p className="font-semibold">{p.closed_signals}</p>
                    <p className="text-xs text-muted">صفقات مغلقة</p>
                  </div>
                </div>

                <form action={isFollowing ? unfollowProvider : followProvider}>
                  <input type="hidden" name="providerId" value={p.provider_id} />
                  <button
                    type="submit"
                    className={
                      isFollowing
                        ? "w-full rounded border border-border px-3 py-2 text-sm"
                        : "w-full rounded bg-brand px-3 py-2 text-sm text-brand-foreground"
                    }
                  >
                    {isFollowing ? "إلغاء المتابعة" : "متابعة"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
