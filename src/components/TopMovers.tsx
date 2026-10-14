import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { nowMs } from "@/lib/now";

// The instruments the platform quotes, with the label shown (codes stay as they are in every language).
const MARKETS: { symbol: string; label: string }[] = [
  { symbol: "XAUUSD", label: "XAU/USD" },
  { symbol: "EURUSD", label: "EUR/USD" },
  { symbol: "GBPUSD", label: "GBP/USD" },
  { symbol: "USDJPY", label: "USD/JPY" },
  { symbol: "BTCUSDT", label: "BTC/USDT" },
  { symbol: "ETHUSDT", label: "ETH/USDT" },
  { symbol: "BNBUSDT", label: "BNB/USDT" },
  { symbol: "SOLUSDT", label: "SOL/USDT" },
  { symbol: "XRPUSDT", label: "XRP/USDT" },
];

const fmt = (n: number) => {
  const d = n >= 1000 ? 0 : n >= 10 ? 2 : 4;
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};

// "Most moved today": the three instruments whose price changed most over the last 24 hours, from the
// stored price history against the current price. Instruments without enough history are left out.
export async function TopMovers() {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();
  const since = new Date(nowMs() - 24 * 60 * 60 * 1000).toISOString();

  const [current, ...baselines] = await Promise.all([
    supabase.from("market_prices").select("symbol, price").in("symbol", MARKETS.map((m) => m.symbol)),
    ...MARKETS.map((m) =>
      supabase.from("price_history").select("price").eq("symbol", m.symbol).gte("ts", since).order("ts", { ascending: true }).limit(1),
    ),
  ]);
  const now = new Map((current.data ?? []).map((r) => [r.symbol as string, Number(r.price)]));

  const rows = MARKETS.flatMap((m, i) => {
    const price = now.get(m.symbol);
    const base = Number(baselines[i].data?.[0]?.price);
    if (!price || !(base > 0)) return [];
    return [{ ...m, price, pct: ((price - base) / base) * 100 }];
  })
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 3);

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t("topMoversTitle")}</h2>
        <Link href="/discover?tab=markets" className="text-sm text-accent hover:underline">
          {t("topMoversAll")}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <Link
            key={r.symbol}
            href={`/discover?tab=markets&symbol=${r.symbol}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-accent/40"
          >
            <span dir="ltr" className="text-sm font-semibold">
              {r.label}
            </span>
            <span className="text-end">
              <span dir="ltr" className="block text-sm tabular-nums">
                {fmt(r.price)}
              </span>
              <span dir="ltr" className={`block text-xs font-semibold tabular-nums ${r.pct >= 0 ? "text-success" : "text-danger"}`}>
                {r.pct >= 0 ? "+" : ""}
                {r.pct.toFixed(2)}%
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
