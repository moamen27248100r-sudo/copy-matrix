import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { followProvider, unfollowProvider } from "@/app/discover/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

type SignalRow = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

function buildEquityCurve(signals: SignalRow[]) {
  const closed = signals
    .filter((s) => s.status === "closed" && s.closed_at && s.exit_price != null)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  let cumulative = 0;
  const points = [0];
  for (const s of closed) {
    const raw = (s.exit_price! - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    cumulative += signed * 100;
    points.push(cumulative);
  }
  return points;
}

function EquityChart({ points }: { points: number[] }) {
  if (points.length < 3) {
    return <p className="text-sm text-muted">لا توجد صفقات مغلقة كافية لعرض الرسم البياني.</p>;
  }

  const width = 600;
  const height = 160;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points
    .map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`)
    .join(" ");
  const zeroY = height - ((0 - min) / range) * height;
  const isPositive = points[points.length - 1] >= 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="var(--border)" strokeDasharray="4" />
      <polyline
        fill="none"
        stroke={isPositive ? "var(--success)" : "var(--danger)"}
        strokeWidth={2}
        points={coords}
      />
    </svg>
  );
}

function periodStats(signals: SignalRow[], days: number) {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const closed = signals.filter(
    (s) => s.status === "closed" && s.closed_at && new Date(s.closed_at).getTime() >= cutoffMs,
  );

  if (closed.length === 0) return { count: 0, winRate: null as number | null, avgReturn: null as number | null };

  let wins = 0;
  let totalReturn = 0;
  for (const s of closed) {
    const raw = (s.exit_price! - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    if (signed > 0) wins++;
    totalReturn += signed * 100;
  }

  return {
    count: closed.length,
    winRate: Math.round((wins / closed.length) * 100),
    avgReturn: Math.round((totalReturn / closed.length) * 100) / 100,
  };
}

export default async function TraderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: provider }, { data: signals }, { data: mySub }] = await Promise.all([
    supabase.from("provider_cards").select("*").eq("provider_id", id).single(),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, exit_price, status, opened_at, closed_at")
      .eq("provider_id", id)
      .order("opened_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("id")
      .eq("follower_id", user.id)
      .eq("provider_id", id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!provider) {
    notFound();
  }

  const allSignals = (signals ?? []) as SignalRow[];
  const isFollowing = !!mySub;

  const periods = [
    { label: "اليوم", days: 1 },
    { label: "أسبوع", days: 7 },
    { label: "شهر", days: 30 },
    { label: "٣ أشهر", days: 90 },
    { label: "٦ أشهر", days: 180 },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link href="/discover" className="w-fit text-sm underline">
          العودة إلى اكتشاف المتداولين
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground text-lg text-background">
            {provider.display_name?.charAt(0) ?? "؟"}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{provider.display_name}</h1>
            <p className="text-xs text-muted">
              عضو منذ{" "}
              {new Date(provider.joined_at).toLocaleDateString("ar-EG", {
                year: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <form action={isFollowing ? unfollowProvider : followProvider}>
            <input type="hidden" name="providerId" value={id} />
            <button
              type="submit"
              className={
                isFollowing
                  ? "rounded border border-border px-4 py-2 text-sm"
                  : "rounded border border-border bg-surface px-4 py-2 text-sm text-foreground"
              }
            >
              {isFollowing ? "إلغاء المتابعة" : "نسخ المتداول"}
            </button>
          </form>
        </div>

        {provider.bio && <p className="text-sm text-muted">{provider.bio}</p>}

        <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
          <div>
            <p className="font-semibold">{provider.followers_count}</p>
            <p className="text-xs text-muted">ناسخ</p>
          </div>
          <div>
            <p className="font-semibold text-success">
              ${Number(provider.total_profit).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">إجمالي الأرباح</p>
          </div>
          <div>
            <p className="font-semibold">
              ${Number(provider.total_withdrawals).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">إجمالي السحوبات</p>
          </div>
          <div>
            <p className="font-semibold">
              {provider.win_rate_pct != null ? `${provider.win_rate_pct}%` : "—"}
            </p>
            <p className="text-xs text-muted">نسبة النجاح الكلية</p>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">منحنى الأداء التراكمي</h2>
        <EquityChart points={buildEquityCurve(allSignals)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">الأداء عبر الفترات</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {periods.map((p) => {
            const stats = periodStats(allSignals, p.days);
            return (
              <div key={p.label} className="rounded-lg border border-border bg-surface p-3 text-center">
                <p className="text-xs text-muted">{p.label}</p>
                <p
                  className={
                    stats.avgReturn != null && stats.avgReturn < 0
                      ? "text-lg font-semibold text-danger"
                      : "text-lg font-semibold text-success"
                  }
                >
                  {stats.avgReturn != null
                    ? `${stats.avgReturn > 0 ? "+" : ""}${stats.avgReturn}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted">
                  {stats.winRate != null ? `نسبة النجاح ${stats.winRate}%` : "لا توجد صفقات"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">سجل الصفقات المغلقة</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-muted">
                <th className="py-2">التاريخ</th>
                <th className="py-2">الرمز</th>
                <th className="py-2">الاتجاه</th>
                <th className="py-2">الدخول</th>
                <th className="py-2">الخروج</th>
                <th className="py-2">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              {allSignals
                .filter((s) => s.status === "closed" && s.exit_price != null)
                .map((s) => {
                  const raw = (s.exit_price! - s.entry_price) / s.entry_price;
                  const signedPct = (s.side === "sell" ? -raw : raw) * 100;
                  const isWin = signedPct >= 0;
                  return (
                    <tr key={s.id} className="border-b border-border/60">
                      <td className="py-2 text-xs text-muted">
                        {new Date(s.opened_at).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="py-2 font-medium">{s.symbol}</td>
                      <td className={s.side === "buy" ? "py-2 text-success" : "py-2 text-danger"}>
                        {s.side === "buy" ? "شراء" : "بيع"}
                      </td>
                      <td className="py-2">{s.entry_price}</td>
                      <td className="py-2">{s.exit_price}</td>
                      <td className="py-2">
                        <span className={isWin ? "text-success" : "text-danger"}>
                          {isWin ? "ربح" : "خسارة"} {signedPct > 0 ? "+" : ""}
                          {signedPct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {allSignals.filter((s) => s.status === "closed").length === 0 && (
            <p className="py-2 text-sm text-muted">لا توجد صفقات مغلقة حتى الآن.</p>
          )}
        </div>
      </section>
    </main>
  );
}
