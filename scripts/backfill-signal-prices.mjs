// Rewrites every existing closed `signals` row to use real historical
// prices from public.price_history instead of fabricated ones, while
// preserving each trade's existing win/loss outcome (per the customer's
// explicit call). high_risk archetype trades get their search window
// extended forward (up to 14 days) to find a real move big enough to
// still feel like a high-risk swing; every other archetype keeps its
// original opened_at/closed_at window as-is.
//
// Only ~82 simulated_positions exist platform-wide (this is mostly
// synthetic leaderboard history with no real followers attached) — for
// the handful tied to a signal this touches, its entry/exit/pnl is
// recomputed to match and the follower's balance is adjusted by the
// exact delta (never re-applying the old amount), same reconciliation
// pattern as editClosedClientPosition in src/app/admin/actions.ts.
//
// Usage: node scripts/backfill-signal-prices.mjs [--symbol=XAUUSD] [--limit=200] [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const args = process.argv.slice(2);
const onlySymbol = args.find((a) => a.startsWith("--symbol="))?.split("=")[1];
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const rowLimit = limitArg ? Number(limitArg) : null;
const dryRun = args.includes("--dry-run");

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "SOLUSDT", "BNBUSDT", "XRPUSDT"]; // US30 excluded — no real source
const DAY_MS = 24 * 60 * 60 * 1000;
const HIGH_RISK_WINDOW_MS = 3 * DAY_MS;
const HIGH_RISK_MAX_EXTEND_MS = 14 * DAY_MS;

// Mirrors src/lib/pip-specs.ts — duplicated here since this is a
// one-time Node backfill script, not app code.
const PIP_SPECS = {
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

// Risk-per-trade as a fraction of the provider's own account_capital —
// varies by archetype so lot size (and therefore $ pnl magnitude)
// reflects trading style, not just capital size alone.
const RISK_FRACTION_RANGE = {
  flagship: [0.01, 0.03],
  stable: [0.005, 0.02],
  balanced: [0.01, 0.03],
  good_rr: [0.01, 0.025],
  high_risk: [0.02, 0.08],
  struggling: [0.02, 0.06],
  default: [0.01, 0.03],
};

function computeLotAndPnl(symbol, entryPrice, exitPrice, side, accountCapital, archetype) {
  const spec = PIP_SPECS[symbol];
  if (!spec || !accountCapital) return { lotSize: null, pnlUsd: null };
  const pips = Math.abs(exitPrice - entryPrice) / spec.pipSize;
  if (pips <= 0) return { lotSize: 0.01, pnlUsd: 0 };
  const [rMin, rMax] = RISK_FRACTION_RANGE[archetype] ?? RISK_FRACTION_RANGE.default;
  const riskFraction = rMin + Math.random() * (rMax - rMin);
  const targetRisk = accountCapital * riskFraction;
  const lotSize = Math.max(0.01, Math.round((targetRisk / (pips * spec.pipValuePerLot)) * 100) / 100);
  const sign = (side === "buy" && exitPrice > entryPrice) || (side === "sell" && exitPrice < entryPrice) ? 1 : -1;
  const pnlUsd = Math.round(pips * spec.pipValuePerLot * lotSize * sign * 100) / 100;
  return { lotSize, pnlUsd };
}
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
  // lo is the first index with ts >= target; pick whichever neighbor is closer.
  if (lo > 0 && Math.abs(sortedTs[lo - 1] - target) <= Math.abs(sortedTs[lo] - target)) return lo - 1;
  return lo;
}

function client() {
  return new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
}

async function loadPriceSeries(db, symbol) {
  const { rows } = await db.query(`select extract(epoch from ts) * 1000 as t, price from public.price_history where symbol = $1 order by ts asc`, [
    symbol,
  ]);
  return { ts: rows.map((r) => Number(r.t)), price: rows.map((r) => Number(r.price)) };
}

function findEntryPrice(series, openedAtMs) {
  const idx = nearestIndex(series.ts, openedAtMs);
  return { price: series.price[idx], idx };
}

// Scans forward from entryIdx (exclusive) up to windowEndMs, returns the
// most extreme real price in `direction` ('max' or 'min'), and its index.
// Critically, the extreme must actually be on the correct side of
// entryPrice — a flat or wrong-direction window must return null (not a
// same-or-worse "extreme"), so the caller's outcome-preservation check
// isn't silently bypassed by a technically-found-but-meaningless point.
function findExtremeInWindow(series, entryIdx, entryPrice, windowEndMs, direction) {
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
  const genuinelyOnCorrectSide = direction === "max" ? bestPrice > entryPrice : bestPrice < entryPrice;
  if (!genuinelyOnCorrectSide) return null;
  return { price: bestPrice, idx: bestIdx };
}

async function processSymbol(db, symbol, providerArchetype, providerPnlAccum, stats) {
  console.log(`\n=== ${symbol} ===`);
  const series = await loadPriceSeries(db, symbol);
  if (series.ts.length === 0) {
    console.log(`  no price_history for ${symbol}, skipping`);
    return;
  }

  let query = `select id, provider_id, side, entry_price, exit_price, opened_at, closed_at
     from public.signals where symbol = $1 and status = 'closed' order by opened_at asc`;
  const params = [symbol];
  if (rowLimit) query += ` limit ${rowLimit}`;

  const { rows: signals } = await db.query(query, params);
  console.log(`  ${signals.length} closed signals to process`);

  const updates = [];
  let flippedCount = 0;

  for (const s of signals) {
    const archetypeInfo = providerArchetype.get(s.provider_id);
    const archetype = archetypeInfo?.isFlagship ? "flagship" : archetypeInfo?.archetype ?? "balanced";

    const wasWin = (s.side === "buy" && Number(s.exit_price) > Number(s.entry_price)) || (s.side === "sell" && Number(s.exit_price) < Number(s.entry_price));
    const direction = (s.side === "buy") === wasWin ? "max" : "min"; // buy+win or sell+loss -> need real high; sell+win or buy+loss -> need real low

    const openedAtMs = new Date(s.opened_at).getTime();
    const originalWindowMs = new Date(s.closed_at).getTime();
    const entry = findEntryPrice(series, openedAtMs);

    let windowEnd = archetype === "high_risk" ? openedAtMs + HIGH_RISK_WINDOW_MS : originalWindowMs;
    let found = findExtremeInWindow(series, entry.idx, entry.price, windowEnd, direction);

    // Extend the search (high_risk gets a longer leash; everyone else
    // gets a modest one) if the outcome genuinely can't be preserved in
    // the original/initial window — real markets rarely stay perfectly
    // flat, but it can happen.
    const maxExtend = archetype === "high_risk" ? HIGH_RISK_MAX_EXTEND_MS : HIGH_RISK_WINDOW_MS;
    while (!found && windowEnd < openedAtMs + maxExtend && entry.idx + 1 < series.ts.length) {
      windowEnd += DAY_MS;
      found = findExtremeInWindow(series, entry.idx, entry.price, windowEnd, direction);
    }

    let finalExit, finalExitTs;
    if (found) {
      finalExit = found.price;
      finalExitTs = series.ts[found.idx];
    } else {
      // Truly flat/no data in range — fall back to the next available
      // real point at all, whatever direction it happens to be (rare;
      // logged so it's visible, not silently swallowed).
      const fallbackIdx = Math.min(entry.idx + 1, series.ts.length - 1);
      finalExit = series.price[fallbackIdx];
      finalExitTs = series.ts[fallbackIdx];
      const nowWin = (s.side === "buy" && finalExit > entry.price) || (s.side === "sell" && finalExit < entry.price);
      if (nowWin !== wasWin) flippedCount++;
    }

    const { lotSize, pnlUsd } = computeLotAndPnl(symbol, entry.price, finalExit, s.side, archetypeInfo?.capital, archetype);
    if (pnlUsd != null) {
      providerPnlAccum.set(s.provider_id, (providerPnlAccum.get(s.provider_id) ?? 0) + pnlUsd);
    }

    updates.push({
      id: s.id,
      entry_price: entry.price,
      exit_price: finalExit,
      closed_at: new Date(finalExitTs).toISOString(),
      lot_size: lotSize,
    });
  }

  stats.flipped += flippedCount;
  stats.total += updates.length;
  console.log(`  computed ${updates.length} updates (${flippedCount} outcome flips due to flat/no real data in range)`);

  if (dryRun) {
    console.log("  DRY RUN — sample of first 3 updates:", updates.slice(0, 3));
    return;
  }

  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const values = chunk
      .map((_, j) => `($${j * 5 + 1}::uuid, $${j * 5 + 2}::numeric, $${j * 5 + 3}::numeric, $${j * 5 + 4}::timestamptz, $${j * 5 + 5}::numeric)`)
      .join(",");
    const params2 = chunk.flatMap((u) => [u.id, u.entry_price, u.exit_price, u.closed_at, u.lot_size]);
    await db.query(
      `update public.signals s set entry_price = v.entry_price, exit_price = v.exit_price, closed_at = v.closed_at, lot_size = v.lot_size
       from (values ${values}) as v(id, entry_price, exit_price, closed_at, lot_size)
       where s.id = v.id`,
      params2,
    );
    process.stdout.write(`\r  updated ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
  }
  console.log("");
}

// US30 has no free real price source, so its existing (fabricated)
// entry/exit prices and timestamps are left exactly as they are — only
// its lot_size gets computed from the provider's new account_capital,
// so US30 trades still participate in the same capital-diverse
// lot/pnl accounting as every other symbol instead of silently
// dropping out of it.
async function assignUS30LotSizes(db, providerArchetype, providerPnlAccum) {
  console.log("\n=== US30 (lot size only — no real price source) ===");
  const { rows: signals } = await db.query(
    `select id, provider_id, side, entry_price, exit_price from public.signals where symbol = 'US30' and status = 'closed'`,
  );
  console.log(`  ${signals.length} closed US30 signals`);

  const updates = [];
  for (const s of signals) {
    const archetypeInfo = providerArchetype.get(s.provider_id);
    const archetype = archetypeInfo?.isFlagship ? "flagship" : archetypeInfo?.archetype ?? "balanced";
    const { lotSize, pnlUsd } = computeLotAndPnl("US30", Number(s.entry_price), Number(s.exit_price), s.side, archetypeInfo?.capital, archetype);
    if (pnlUsd != null) providerPnlAccum.set(s.provider_id, (providerPnlAccum.get(s.provider_id) ?? 0) + pnlUsd);
    updates.push({ id: s.id, lot_size: lotSize });
  }

  if (dryRun) {
    console.log("  DRY RUN — sample:", updates.slice(0, 3));
    return;
  }

  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const values = chunk.map((_, j) => `($${j * 2 + 1}::uuid, $${j * 2 + 2}::numeric)`).join(",");
    const params2 = chunk.flatMap((u) => [u.id, u.lot_size]);
    await db.query(
      `update public.signals s set lot_size = v.lot_size from (values ${values}) as v(id, lot_size) where s.id = v.id`,
      params2,
    );
    process.stdout.write(`\r  updated ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
  }
  console.log("");
}

async function recomputeTotalProfit(db, providerPnlAccum) {
  console.log("\n=== recomputing providers.total_profit from real lot-based pnl ===");
  if (dryRun) {
    console.log(`  DRY RUN — would update total_profit for ${providerPnlAccum.size} providers`);
    return;
  }
  const entries = [...providerPnlAccum.entries()];
  const CHUNK = 500;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const values = chunk.map((_, j) => `($${j * 2 + 1}::uuid, $${j * 2 + 2}::numeric)`).join(",");
    const params = chunk.flatMap(([providerId, pnl]) => [providerId, Math.round(pnl * 100) / 100]);
    await db.query(
      `update public.providers p set total_profit = v.profit from (values ${values}) as v(id, profit) where p.id = v.id`,
      params,
    );
    process.stdout.write(`\r  updated ${Math.min(i + CHUNK, entries.length)}/${entries.length}`);
  }
  console.log(`\n  updated total_profit for ${providerPnlAccum.size} providers`);
}

async function reconcileLinkedPositions(db) {
  console.log("\n=== reconciling linked simulated_positions ===");
  const { rows: positions } = await db.query(`
    select sp.id, sp.follower_id, sp.entry_price as old_entry, sp.exit_price as old_exit, sp.size, sp.pnl as old_pnl,
      s.entry_price as new_entry, s.exit_price as new_exit, s.side
    from public.simulated_positions sp
    join public.signals s on s.id = sp.signal_id
    where sp.status = 'closed'
  `);
  console.log(`  ${positions.length} closed positions linked to signals`);

  for (const p of positions) {
    const sign = p.side === "sell" ? -1 : 1;
    const newPnl = ((Number(p.new_exit) - Number(p.new_entry)) / Number(p.new_entry)) * Number(p.size) * sign;
    const delta = newPnl - Number(p.old_pnl ?? 0);
    if (Math.abs(delta) < 0.01) continue;

    console.log(`  position ${p.id}: pnl ${p.old_pnl} -> ${newPnl.toFixed(2)} (delta ${delta.toFixed(2)})`);
    if (dryRun) continue;

    await db.query(`update public.simulated_positions set entry_price = $1, exit_price = $2, pnl = $3 where id = $4`, [
      p.new_entry,
      p.new_exit,
      newPnl,
      p.id,
    ]);

    const { rows: prof } = await db.query(`select balance from public.profiles where id = $1`, [p.follower_id]);
    const newBalance = Number(prof[0].balance) + delta;
    await db.query(`update public.profiles set balance = $1 where id = $2`, [newBalance, p.follower_id]);
    await db.query(
      `insert into public.wallet_transactions (user_id, type, amount, balance_after, note) values ($1, 'admin_adjustment', $2, $3, $4)`,
      [p.follower_id, delta, newBalance, "إعادة احتساب نتيجة صفقة بأسعار حقيقية"],
    );
  }
}

const db = client();
await db.connect();

const { rows: providers } = await db.query(`select id, risk_archetype, display_name, account_capital from public.providers`);
const providerArchetype = new Map(
  providers.map((p) => [
    p.id,
    { archetype: p.risk_archetype ?? "balanced", isFlagship: FLAGSHIP_NAMES.has(p.display_name), capital: Number(p.account_capital) || null },
  ]),
);

const stats = { total: 0, flipped: 0 };
const providerPnlAccum = new Map();
const symbolsToRun = onlySymbol ? [onlySymbol] : SYMBOLS;
for (const symbol of symbolsToRun) {
  await processSymbol(db, symbol, providerArchetype, providerPnlAccum, stats);
}

if (!onlySymbol) {
  await assignUS30LotSizes(db, providerArchetype, providerPnlAccum);
  await reconcileLinkedPositions(db);
  await recomputeTotalProfit(db, providerPnlAccum);
}

console.log(`\nTOTAL: ${stats.total} signals processed, ${stats.flipped} outcome flips (flat/no-data fallback)`);
await db.end();
