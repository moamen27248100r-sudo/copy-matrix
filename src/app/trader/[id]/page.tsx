import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { followProvider, unfollowProvider, followTrader, unfollowTrader } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { TraderEquityChart } from "@/components/TraderEquityChart";
import { TradeHistory } from "@/components/TradeHistory";
import { CircularGauge } from "@/components/CircularGauge";
import { AssetAllocationBar } from "@/components/AssetAllocationBar";
import { OpenOrdersTable } from "@/components/OpenOrdersTable";

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

function computeMaxDrawdown(signals: SignalRow[]) {
  const closed = signals
    .filter((s) => s.status === "closed" && s.exit_price != null && s.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  if (closed.length === 0) return null;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const s of closed) {
    const raw = (s.exit_price! - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    cumulative += signed * 100;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return Math.round(maxDrawdown * 100) / 100;
}

export default async function TraderPage({
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
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: provider }, { data: signals }, { data: mySub }, { data: myProfile }, { data: otherSub }, { data: myFollow }] = await Promise.all([
    supabase.from("provider_cards").select("*").eq("provider_id", id).single(),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, exit_price, status, opened_at, closed_at")
      .eq("provider_id", id)
      .order("opened_at", { ascending: false }),
    user
      ? supabase
          .from("subscriptions")
          .select("id, allocated_amount, max_drawdown_pct")
          .eq("follower_id", user.id)
          .eq("provider_id", id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("profiles").select("balance").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("subscriptions")
          .select("provider_id")
          .eq("follower_id", user.id)
          .eq("is_active", true)
          .neq("provider_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("provider_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!provider) {
    notFound();
  }

  const allSignals = (signals ?? []) as SignalRow[];
  const isFollowing = !!mySub;
  const isFollowingTrader = !!myFollow;
  const maxDrawdown = computeMaxDrawdown(allSignals);

  const closedHistory = allSignals
    .filter((s) => s.status === "closed" && s.exit_price != null)
    .map((s) => {
      const raw = (s.exit_price! - s.entry_price) / s.entry_price;
      const pct = (s.side === "sell" ? -raw : raw) * 100;
      return {
        id: s.id,
        symbol: s.symbol,
        side: s.side,
        entry: Number(s.entry_price),
        exit: Number(s.exit_price),
        pct,
        closedAt: s.closed_at,
      };
    });

  const openOrders = allSignals.filter((s) => s.status === "open");
  const openSymbols = Array.from(new Set(openOrders.map((s) => s.symbol)));
  const { data: livePrices } =
    openSymbols.length > 0
      ? await supabase.from("market_prices").select("symbol, price").in("symbol", openSymbols)
      : { data: [] as { symbol: string; price: number }[] };
  const priceBySymbol = new Map((livePrices ?? []).map((p) => [p.symbol, Number(p.price)]));

  const reliabilityScore = Number(provider.rating_score ?? 50);
  const safetyScore = Math.max(0, Math.min(100, Math.round(100 - Number(provider.return_volatility ?? 2) * 15)));
  const riskExposureScore =
    maxDrawdown != null ? Math.max(0, Math.min(100, Math.round(maxDrawdown * 8))) : 20;

  const daysAsMember = Math.max(
    0,
    Math.floor((Date.now() - new Date(provider.joined_at).getTime()) / (24 * 60 * 60 * 1000)),
  );

  let otherProviderName: string | null = null;
  if (otherSub) {
    const { data: otherProvider } = await supabase
      .from("provider_cards")
      .select("display_name")
      .eq("provider_id", otherSub.provider_id)
      .single();
    otherProviderName = otherProvider?.display_name ?? "متداول آخر";
  }
  const isBlocked = !!otherSub;

  const periods = [
    { label: "اليوم", days: 1 },
    { label: "أسبوع", days: 7 },
    { label: "شهر", days: 30 },
    { label: "٣ أشهر", days: 90 },
    { label: "٦ أشهر", days: 180 },
  ];

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <Link href="/discover" className="w-fit text-sm underline">
          العودة إلى اكتشاف المتداولين
        </Link>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-lg font-semibold text-white">
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
          {user ? (
            <form action={isFollowingTrader ? unfollowTrader : followTrader}>
              <input type="hidden" name="providerId" value={id} />
              <button
                type="submit"
                className={
                  isFollowingTrader
                    ? "rounded-full border border-accent bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent"
                    : "rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
                }
              >
                {isFollowingTrader ? "متابَع ✓" : "متابعة"}
              </button>
            </form>
          ) : (
            <Link
              href={`/signup?next=${encodeURIComponent(`/trader/${id}`)}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
            >
              متابعة
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="rounded border border-border px-2 py-0.5 text-muted">{provider.tier}</span>
          <span className="rounded border border-border px-2 py-0.5 text-muted">
            مستوى المخاطرة: {provider.risk_level}
          </span>
        </div>

        {provider.bio && <p className="text-sm text-muted">{provider.bio}</p>}

        <div id="copy" className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 scroll-mt-20">
          {!user ? (
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                سجّل حساب مجانًا لتتمكن من نسخ {provider.display_name} ومتابعة أداء صفقاته.
              </p>
              <Link
                href={`/signup?next=${encodeURIComponent(`/trader/${id}#copy`)}`}
                className="w-full shrink-0 rounded bg-accent px-4 py-1.5 text-center text-sm font-medium text-accent-foreground transition hover:bg-accent-hover sm:w-fit"
              >
                إنشاء حساب مجاني
              </Link>
            </div>
          ) : isBlocked ? (
            <div className="flex flex-col gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <p>
                أنت تنسخ حاليًا <strong>{otherProviderName}</strong>. يمكنك نسخ متداول واحد فقط في نفس
                الوقت — أوقف النسخ أولاً من{" "}
                <Link href="/portfolio" className="underline">
                  محفظتك
                </Link>{" "}
                لتتمكن من نسخ {provider.display_name}.
              </p>
            </div>
          ) : (
          <form action={followProvider} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="providerId" value={id} />
            <label className="flex items-center gap-2 text-sm text-muted">
              مبلغ النسخ
              <input
                name="allocatedAmount"
                type="number"
                step="any"
                min={provider.min_copy_amount}
                defaultValue={mySub?.allocated_amount ?? provider.min_copy_amount}
                required
                className="w-28 rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
            >
              {isFollowing ? "تحديث الإعدادات" : "نسخ"}
            </button>
          </form>
          )}
          {isFollowing && (
            <form action={unfollowProvider}>
              <input type="hidden" name="providerId" value={id} />
              <button type="submit" className="rounded border border-border px-4 py-1.5 text-sm">
                إيقاف النسخ
              </button>
            </form>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
          <span>الحد الأدنى للنسخ عند هذا المتداول: ${Number(provider.min_copy_amount).toLocaleString("en-US")}</span>
          {user && (
            <span>
              رصيدك المتاح: {myProfile?.balance != null ? `$${Number(myProfile.balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold">{provider.followers_count}</p>
            <p className="text-xs text-muted">ناسخ</p>
          </div>
          <div>
            <p className={Number(provider.total_profit) >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
              {Number(provider.total_profit) >= 0 ? "+" : "-"}$
              {Math.abs(Number(provider.total_profit)).toLocaleString("en-US", { maximumFractionDigits: 0 })}
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
          <div>
            <p className="font-semibold text-danger" dir="ltr">
              {maxDrawdown != null ? `-${maxDrawdown}%` : "—"}
            </p>
            <p className="text-xs text-muted">أقصى تراجع</p>
          </div>
          <div>
            <p className="font-semibold">${Number(provider.min_copy_amount).toLocaleString("en-US")}</p>
            <p className="text-xs text-muted">الحد الأدنى للنسخ</p>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">مستوى موثوقية التداول</h2>
        <div className="grid grid-cols-3 gap-3">
          <CircularGauge value={reliabilityScore} label="الموثوقية" />
          <CircularGauge value={safetyScore} label="درجة الأمان" />
          <CircularGauge value={riskExposureScore} label="قيمة معرضة للمخاطرة" invert />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <div>
              <p className="text-sm font-semibold">{closedHistory.length}</p>
              <p className="text-[11px] text-muted">صفقة مغلقة</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <div>
              <p className="text-sm font-semibold">{daysAsMember}</p>
              <p className="text-[11px] text-muted">يوم عضوية</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">منحنى الأداء التراكمي</h2>
        <TraderEquityChart signals={allSignals} />
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

      {allSignals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">أدوات التداول</h2>
          <AssetAllocationBar signals={allSignals} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">الأوامر المفتوحة</h2>
        <OpenOrdersTable orders={openOrders} priceBySymbol={priceBySymbol} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">سجل الصفقات</h2>
        {closedHistory.length === 0 ? (
          <p className="text-sm text-muted">لا توجد صفقات مغلقة حتى الآن.</p>
        ) : (
          <TradeHistory trades={closedHistory} />
        )}
      </section>
      </main>
    </>
  );
}
