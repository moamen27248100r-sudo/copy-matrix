// Remediation for the real-price backfill's forex outcome-flip problem
// (EURUSD/GBPUSD/USDJPY hit a 36-38% flip rate vs ~2% for crypto/gold,
// because frankfurter's daily-resolution data left almost no real
// candidate points inside a typical 30-210 minute trade window — no
// backup of the pre-backfill state exists to restore the exact
// original per-trade outcome, so instead every forex signal gets a
// FRESH, statistically-correct win/loss rolled from its provider's own
// skill (same formula the platform already uses:
// is_win = random() < skill), then matched to real prices using a much
// wider search window (60 days, vs the original 3-14) — so the
// aggregate win rate per leader stays honest to their skill level, and
// the price data stays real with a low flip/fallback rate this time.
//
// Usage: node scripts/refix-forex-signals.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const FOREX_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY"];
const DAY_MS = 24 * 60 * 60 * 1000;
const WIDE_WINDOW_MS = 60 * DAY_MS;

const PIP_SPECS = {
  EURUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  GBPUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
  USDJPY: { pipSize: 0.01, pipValuePerLot: 9 },
};
const RISK_FRACTION_RANGE = {
  flagship: [0.01, 0.03],
  stable: [0.005, 0.02],
  balanced: [0.01, 0.03],
  good_rr: [0.01, 0.025],
  high_risk: [0.02, 0.08],
  struggling: [0.02, 0.06],
  default: [0.01, 0.03],
};
const FLAGSHIP_NAMES = new Set(["أنس ريان", "يوسف علي"]);

function nearestIndex(sortedTs, target) {
  let lo = 0,
    hi = sortedTs.length - 1;
  if (target <= sortedTs[0]) return 0;
  if (target >= sortedTs[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTs[mid] === target) return mid;
    if (sortedTs[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(sortedTs[lo - 1] - target) <= Math.abs(sortedTs[lo] - target)) return lo - 1;
  return lo;
}

function findExtreme(series, entryIdx, entryPrice, windowEndMs, direction) {
  let bestIdx = -1;
  let bestPrice = direction === "max" ? -Infinity : Infinity;
  for (let i = entryIdx + 1; i < series.ts.length && series.ts[i] <= windowEndMs; i++) {
    const p = series.price[i];
    if ((direction === "max" && p > bestPrice) || (direction === "min" && p < bestPrice)) {
      bestPrice = p;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  const onCorrectSide = direction === "max" ? bestPrice > entryPrice : bestPrice < entryPrice;
  return onCorrectSide ? { price: bestPrice, idx: bestIdx } : null;
}

function computeLotAndPnl(symbol, entryPrice, exitPrice, side, accountCapital, archetype) {
  const spec = PIP_SPECS[symbol];
  const pips = Math.abs(exitPrice - entryPrice) / spec.pipSize;
  if (pips <= 0 || !accountCapital) return { lotSize: 0.01, pnlUsd: 0 };
  const [rMin, rMax] = RISK_FRACTION_RANGE[archetype] ?? RISK_FRACTION_RANGE.default;
  const riskFraction = rMin + Math.random() * (rMax - rMin);
  const targetRisk = accountCapital * riskFraction;
  const lotSize = Math.max(0.01, Math.round((targetRisk / (pips * spec.pipValuePerLot)) * 100) / 100);
  const sign = (side === "buy" && exitPrice > entryPrice) || (side === "sell" && exitPrice < entryPrice) ? 1 : -1;
  const pnlUsd = Math.round(pips * spec.pipValuePerLot * lotSize * sign * 100) / 100;
  return { lotSize, pnlUsd };
}

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows: providers } = await db.query(
  `select id, risk_archetype, display_name, account_capital, skill from public.providers`,
);
const providerInfo = new Map(
  providers.map((p) => [
    p.id,
    {
      archetype: FLAGSHIP_NAMES.has(p.display_name) ? "flagship" : p.risk_archetype ?? "balanced",
      capital: Number(p.account_capital) || null,
      skill: Number(p.skill) || 0.5,
    },
  ]),
);

const providerPnlAccum = new Map();
let totalProcessed = 0;
let totalFallback = 0;

for (const symbol of FOREX_SYMBOLS) {
  console.log(`\n=== refixing ${symbol} ===`);
  const { rows: priceRows } = await db.query(
    `select extract(epoch from ts) * 1000 as t, price from public.price_history where symbol = $1 order by ts asc`,
    [symbol],
  );
  const series = { ts: priceRows.map((r) => Number(r.t)), price: priceRows.map((r) => Number(r.price)) };

  const { rows: signals } = await db.query(
    `select id, provider_id, side, opened_at from public.signals where symbol = $1 and status = 'closed' order by opened_at asc`,
    [symbol],
  );
  console.log(`  ${signals.length} signals`);

  const updates = [];
  let fallbackCount = 0;

  for (const s of signals) {
    const info = providerInfo.get(s.provider_id) ?? { archetype: "balanced", capital: 2000, skill: 0.5 };
    const isWin = Math.random() < info.skill;
    const direction = (s.side === "buy") === isWin ? "max" : "min";

    const openedAtMs = new Date(s.opened_at).getTime();
    const entryIdx = nearestIndex(series.ts, openedAtMs);
    const entryPrice = series.price[entryIdx];

    let windowEnd = openedAtMs + WIDE_WINDOW_MS;
    let found = findExtreme(series, entryIdx, entryPrice, windowEnd, direction);

    let finalExit, finalExitTs;
    if (found) {
      finalExit = found.price;
      finalExitTs = series.ts[found.idx];
    } else {
      fallbackCount++;
      const fallbackIdx = Math.min(entryIdx + 1, series.ts.length - 1);
      finalExit = series.price[fallbackIdx];
      finalExitTs = series.ts[fallbackIdx];
    }

    const { lotSize, pnlUsd } = computeLotAndPnl(symbol, entryPrice, finalExit, s.side, info.capital, info.archetype);
    providerPnlAccum.set(s.provider_id, (providerPnlAccum.get(s.provider_id) ?? 0) + pnlUsd);

    updates.push({
      id: s.id,
      entry_price: entryPrice,
      exit_price: finalExit,
      closed_at: new Date(finalExitTs).toISOString(),
      lot_size: lotSize,
    });
  }

  console.log(`  ${fallbackCount} fallbacks (${((fallbackCount / signals.length) * 100).toFixed(1)}%)`);
  totalProcessed += updates.length;
  totalFallback += fallbackCount;

  if (dryRun) {
    console.log("  DRY RUN sample:", updates.slice(0, 3));
    continue;
  }

  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const values = chunk
      .map((_, j) => `($${j * 5 + 1}::uuid, $${j * 5 + 2}::numeric, $${j * 5 + 3}::numeric, $${j * 5 + 4}::timestamptz, $${j * 5 + 5}::numeric)`)
      .join(",");
    const params = chunk.flatMap((u) => [u.id, u.entry_price, u.exit_price, u.closed_at, u.lot_size]);
    await db.query(
      `update public.signals s set entry_price = v.entry_price, exit_price = v.exit_price, closed_at = v.closed_at, lot_size = v.lot_size
       from (values ${values}) as v(id, entry_price, exit_price, closed_at, lot_size)
       where s.id = v.id`,
      params,
    );
    process.stdout.write(`\r  updated ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
  }
  console.log("");
}

console.log(`\nTOTAL forex: ${totalProcessed} processed, ${totalFallback} fallbacks (${((totalFallback / totalProcessed) * 100).toFixed(1)}%)`);

// Now do a GLOBAL fresh recompute of total_profit for every provider,
// from ALL their signals (all 10 symbols) as currently stored — not
// just forex — so nothing double-counts or goes stale after this pass.
if (!dryRun) {
  console.log("\n=== global recompute of total_profit from ALL current signal data ===");
  const { rows: allSignals } = await db.query(`
    select provider_id, side, entry_price, exit_price, lot_size, symbol
    from public.signals where status = 'closed' and lot_size is not null
  `);
  const ALL_PIP_SPECS = {
    XAUUSD: { pipSize: 0.1, pipValuePerLot: 10 },
    EURUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
    GBPUSD: { pipSize: 0.0001, pipValuePerLot: 10 },
    USDJPY: { pipSize: 0.01, pipValuePerLot: 9 },
    BTCUSDT: { pipSize: 1, pipValuePerLot: 1 },
    ETHUSDT: { pipSize: 0.1, pipValuePerLot: 1 },
    SOLUSDT: { pipSize: 0.01, pipValuePerLot: 1 },
    BNBUSDT: { pipSize: 0.1, pipValuePerLot: 1 },
    XRPUSDT: { pipSize: 0.0001, pipValuePerLot: 1 },
    US30: { pipSize: 1, pipValuePerLot: 1 },
  };
  const globalPnl = new Map();
  for (const s of allSignals) {
    const spec = ALL_PIP_SPECS[s.symbol];
    if (!spec) continue;
    const entry = Number(s.entry_price);
    const exit = Number(s.exit_price);
    const pips = Math.abs(exit - entry) / spec.pipSize;
    const sign = (s.side === "buy" && exit > entry) || (s.side === "sell" && exit < entry) ? 1 : -1;
    const pnl = pips * spec.pipValuePerLot * Number(s.lot_size) * sign;
    globalPnl.set(s.provider_id, (globalPnl.get(s.provider_id) ?? 0) + pnl);
  }

  const entries = [...globalPnl.entries()];
  const CHUNK = 500;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const values = chunk.map((_, j) => `($${j * 2 + 1}::uuid, $${j * 2 + 2}::numeric)`).join(",");
    const params = chunk.flatMap(([id, pnl]) => [id, Math.round(pnl * 100) / 100]);
    await db.query(
      `update public.providers p set total_profit = v.profit from (values ${values}) as v(id, profit) where p.id = v.id`,
      params,
    );
    process.stdout.write(`\r  updated ${Math.min(i + CHUNK, entries.length)}/${entries.length}`);
  }
  console.log(`\n  recomputed total_profit for ${entries.length} providers`);
}

await db.end();
