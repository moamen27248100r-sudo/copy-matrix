import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createLeader, updateLeader, deleteLeader } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

const PAGE_SIZE = 25;

export default async function AdminTradersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; error?: string }>;
}) {
  const { q, page: pageParam, error } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let leaderQuery = supabase
    .from("providers")
    .select(
      "id, display_name, bio, skill, min_copy_amount, base_followers_count, total_profit, total_withdrawals, created_at, user_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) {
    leaderQuery = leaderQuery.ilike("display_name", `%${q}%`);
  }

  const { data: leaders, count } = await leaderQuery;
  const leaderIds = (leaders ?? []).map((l) => l.id);
  const { data: leaderCards } =
    leaderIds.length > 0
      ? await supabase
          .from("provider_cards")
          .select("provider_id, followers_count, win_rate_pct, avg_return_pct, tier, rating_score")
          .in("provider_id", leaderIds)
      : { data: [] };

  const leaderCardById = new Map((leaderCards ?? []).map((c) => [c.provider_id, c]));
  const leaderRows = (leaders ?? []).map((l) => ({ ...l, card: leaderCardById.get(l.id) }));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">إدارة المتداولين</h1>
        <span className="text-sm text-muted">{count ?? 0} متداول</span>
      </div>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <form className="flex gap-2">
        <input
          name="q"
          type="text"
          defaultValue={q ?? ""}
          placeholder="ابحث باسم المتداول"
          className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded border border-border bg-surface px-4 py-2 text-sm">
          بحث
        </button>
      </form>

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
        <p className="text-sm text-muted">لا يوجد متداولون.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {leaderRows.map((l) => (
            <details key={l.id} className="rounded-lg border border-border bg-surface p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{l.display_name}</span>
                <span className="flex flex-wrap gap-1.5 text-xs text-muted">
                  <span className="rounded border border-border px-2 py-0.5">{l.card?.tier ?? "—"}</span>
                  <span className="rounded border border-border px-2 py-0.5">تقييم {l.card?.rating_score ?? "—"}</span>
                  <span className="rounded border border-border px-2 py-0.5">{l.card?.followers_count ?? 0} متابع</span>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link
            href={`/admin/traders?q=${encodeURIComponent(q ?? "")}&page=${Math.max(1, page - 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            السابق
          </Link>
          <span className="text-muted">
            صفحة {page} من {totalPages}
          </span>
          <Link
            href={`/admin/traders?q=${encodeURIComponent(q ?? "")}&page=${Math.min(totalPages, page + 1)}`}
            className={`rounded border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            التالي
          </Link>
        </div>
      )}
    </>
  );
}
