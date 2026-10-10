// Rebuilt leader track records (scripts/sim/rebuild.mjs, migration 0246) against
// SUPABASE_DB_URL:
//  1. every number of the leader page / discover / admin (provider_stats) equals the
//     formula applied by hand to the leader's trades and cash flows;
//  2. each trade's P&L, commission and swap are exactly what public.sim_close_trade
//     computes from its prices and lot;
//  3. writing the same history twice leaves exactly one copy of each trade, and the
//     trades customers copied are kept.
// Everything runs in one transaction that is rolled back. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";
import { MinuteSeries, SYMBOLS, MINUTE, DAY } from "../scripts/sim/candles.mjs";
import { Market, simulateLeader, followerSeries, SPECS } from "../scripts/sim/engine.mjs";
import { candidatePersona } from "../scripts/sim/personas.mjs";
import { leaderMetrics } from "../scripts/sim/validate.mjs";
import { buildDaily, writeBatch, signalId, HISTORY_VERSION } from "../scripts/sim/rebuild.mjs";
import { Rng } from "../scripts/sim/rng.mjs";

config({ path: ".env.local", quiet: true });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const q = async (sql, params) => (await db.query(sql, params)).rows;
let leaders = [];

before(async () => {
  await db.connect();
  await db.query("begin");
  // Up to 6 rebuilt leaders of different personas.
  leaders = await q(`select distinct on (p.persona ->> 'key') p.id, p.persona ->> 'key' as key
                     from public.sim_history_builds b join public.providers p on p.id = b.provider_id
                     where b.version = $1 order by p.persona ->> 'key', b.trades desc limit 6`, [HISTORY_VERSION]);
  // Stats as of this snapshot (the live engine may have closed a trade since the last refresh).
  if (leaders.length) await q("select public.refresh_provider_stats($1::uuid[], true)", [leaders.map((l) => l.id)]);
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

const cents = (v) => Math.round(Number(v) * 100);
const r2 = (x) => Math.round(x * 100) / 100;
const near = (a, b, tol, msg) => assert.ok(Math.abs(Number(a) - Number(b)) <= tol, `${msg}: ${a} vs ${b}`);

test("rebuilt leaders exist", () => {
  assert.ok(leaders.length >= 1, "run scripts/sim/rebuild.mjs --apply first");
});

test("every stored stat equals the formula applied to the trades", async () => {
  const [{ today }] = await q("select current_date::text as today");
  const todayK = Date.parse(today + "T00:00:00Z") / DAY;
  for (const { id, key } of leaders) {
    const trades = await q(
      `select symbol, side, status, opened_at, closed_at, pnl_usd, close_trigger from public.signals
       where provider_id = $1 and not hidden and not created_by_admin`,
      [id],
    );
    const flows = await q("select at, amount, kind from public.provider_cash_flows where provider_id = $1", [id]);
    const ledger = await q("select day::text, trades, wins, pnl, cash_flow, start_equity from public.provider_daily where provider_id = $1 order by day", [id]);
    const [st] = await q("select * from public.provider_stats where provider_id = $1", [id]);
    const [card] = await q("select * from public.provider_cards where provider_id = $1", [id]);
    const [prov] = await q("select account_capital, total_profit from public.providers where id = $1", [id]);
    const closed = trades.filter((t) => t.status === "closed");
    const dayOf = (d) => new Date(d).toISOString().slice(0, 10);

    // The ledger is the trades and cash flows per UTC day.
    const byDay = new Map(ledger.map((d) => [d.day, { trades: 0, wins: 0, pnl: 0, cash: 0 }]));
    for (const t of closed) {
      const r = byDay.get(dayOf(t.closed_at));
      assert.ok(r, `${key}: ledger row for ${dayOf(t.closed_at)}`);
      r.trades++;
      if (Number(t.pnl_usd) > 0) r.wins++;
      r.pnl += cents(t.pnl_usd);
    }
    for (const c of flows) byDay.get(dayOf(c.at)).cash += cents(c.amount);
    let equity = 0;
    const rets = [];
    for (const d of ledger) {
      const r = byDay.get(d.day);
      assert.equal(d.trades, r.trades, `${key} ${d.day} trades`);
      assert.equal(d.wins, r.wins, `${key} ${d.day} wins`);
      assert.equal(cents(d.pnl), r.pnl, `${key} ${d.day} pnl`);
      assert.equal(cents(d.cash_flow), r.cash, `${key} ${d.day} cash`);
      assert.equal(cents(d.start_equity), equity, `${key} ${d.day} start equity`);
      const base = equity + r.cash;
      rets.push({ age: todayK - Date.parse(d.day + "T00:00:00Z") / DAY, r: base > 0 ? r.pnl / base : 0, trades: r.trades, wins: r.wins, pnl: r.pnl });
      equity += r.cash + r.pnl;
    }
    assert.equal(cents(prov.account_capital), equity, `${key}: capital = last equity`);
    assert.equal(cents(prov.total_profit), closed.reduce((a, t) => a + cents(t.pnl_usd), 0), `${key}: total profit`);

    // Period stats from the daily returns.
    for (const [period, sfx] of [[7, "7d"], [30, "30d"], [90, "90d"], [180, "180d"], [Infinity, "all"]]) {
      const rows = rets.filter((x) => x.age < period);
      let l = 0;
      let peak = 0;
      let mdd = 0;
      for (const x of rows) {
        l += Math.log(Math.max(1e-9, 1 + x.r));
        peak = Math.max(peak, l);
        mdd = Math.max(mdd, 1 - Math.exp(l - peak));
      }
      const n = rows.reduce((a, x) => a + x.trades, 0);
      const w = rows.reduce((a, x) => a + x.wins, 0);
      near(st[`roi_${sfx}`], r2(100 * (Math.exp(l) - 1)), 0.011, `${key} roi_${sfx}`);
      near(st[`mdd_${sfx}`], r2(100 * mdd), 0.011, `${key} mdd_${sfx}`);
      assert.equal(cents(st[`pnl_${sfx}`]), rows.reduce((a, x) => a + x.pnl, 0), `${key} pnl_${sfx}`);
      assert.equal(st[`trades_${sfx}`], n, `${key} trades_${sfx}`);
      if (n) near(st[`win_rate_${sfx}`], Math.round((1000 * w) / n) / 10, 0.051, `${key} win_rate_${sfx}`);
      if (rows.length > 2) {
        const mean = rows.reduce((a, x) => a + x.r, 0) / rows.length;
        const sd = Math.sqrt(rows.reduce((a, x) => a + (x.r - mean) ** 2, 0) / (rows.length - 1));
        if (sd > 0) near(st[`sharpe_${sfx}`], r2((mean / sd) * Math.sqrt(365)), 0.011, `${key} sharpe_${sfx}`);
      }
    }

    // Trade-level stats.
    const days = new Set(trades.flatMap((t) => [dayOf(t.opened_at), ...(t.closed_at ? [dayOf(t.closed_at)] : [])]));
    assert.equal(st.active_days, days.size, `${key} active days`);
    const hours = closed.map((t) => (new Date(t.closed_at) - new Date(t.opened_at)) / 3600000);
    near(st.avg_hold_hours, r2(hours.reduce((a, b) => a + b, 0) / hours.length), 0.011, `${key} avg hold`);
    const limits = closed.filter((t) => t.close_trigger === "tp" || t.close_trigger === "sl").length;
    near(st.limit_pct, Math.round((1000 * limits) / closed.length) / 10, 0.051, `${key} limit share`);
    const mix = {};
    for (const t of closed) mix[t.symbol] = (mix[t.symbol] ?? 0) + 1;
    assert.deepEqual(st.asset_mix, mix, `${key} asset mix`);
    const withdrawals = flows.filter((c) => c.kind === "withdrawal").reduce((a, c) => a - cents(c.amount), 0);
    assert.equal(cents(st.total_withdrawals), withdrawals, `${key} withdrawals`);
    // The page / discover / admin read the same row.
    assert.equal(card.closed_signals, st.trades_all);
    assert.equal(Number(card.total_profit), Number(st.pnl_all));
    assert.equal(card.open_signals, String(trades.filter((t) => t.status === "open").length));
  }
});

test("P&L, commission and swap are what sim_close_trade computes", async () => {
  const ids = leaders.map((l) => l.id);
  const [bad] = await q(
    `with t as (
       select g.*, s.kind, s.fee, s.comm, s.swap as swap_rate,
              (select count(*) from generate_series(
                  date_trunc('day', g.opened_at at time zone 'UTC') at time zone 'UTC' + interval '22 hours',
                  g.closed_at, interval '1 day') r
                where r > g.opened_at and r < g.closed_at and public.sim_market_open(g.symbol, r - interval '1 hour')) nights
       from public.signals g join public.sim_symbols s on s.symbol = g.symbol
       where g.provider_id = any($1) and g.status = 'closed' and not g.hidden)
     select count(*) n,
       count(*) filter (where commission <> case when kind = 'crypto'
           then round(fee * (public.sim_notional(symbol, lot_size, entry_price) + public.sim_notional(symbol, lot_size, exit_price)) / 2, 2)
           else round(comm * lot_size, 2) end) bad_commission,
       count(*) filter (where swap <> case when kind = 'crypto' then 0 else round(swap_rate * lot_size * nights, 2) end) bad_swap,
       count(*) filter (where pnl_usd <> round(public.trade_profit_usd(symbol, side, entry_price, exit_price, lot_size) - commission + swap, 2)) bad_pnl,
       count(*) filter (where public.trade_exit_beyond_level(side, entry_price, exit_price, stop_loss, take_profit) is not null) beyond_level,
       count(*) filter (where closed_at <= opened_at) bad_time
     from t`,
    [ids],
  );
  assert.ok(Number(bad.n) > 0);
  assert.equal(Number(bad.bad_commission), 0, "commission");
  assert.equal(Number(bad.bad_swap), 0, "swap");
  assert.equal(Number(bad.bad_pnl), 0, "pnl");
  assert.equal(Number(bad.beyond_level), 0, "exit beyond a level");
  assert.equal(Number(bad.bad_time), 0, "closes after it opens");
});

test("gold and forex trades never open or close while their market is closed", async () => {
  const [r] = await q(
    `select count(*) filter (where not public.sim_market_open(symbol, opened_at)) bad_open,
            count(*) filter (where status = 'closed' and not public.sim_market_open(symbol, closed_at - interval '30 seconds')
                                                     and not public.sim_market_open(symbol, closed_at)) bad_close
     from public.signals where provider_id = any($1) and not hidden`,
    [leaders.map((l) => l.id)],
  );
  assert.equal(Number(r.bad_open), 0);
  assert.equal(Number(r.bad_close), 0);
});

// A small causal history on synthetic candles, in the shape writeBatch takes.
function syntheticBuild(leader, persona0) {
  const from = Date.UTC(2025, 0, 1);
  const to = Date.UTC(2025, 1, 20);
  const n = (to - from) / MINUTE;
  const series = {};
  for (const sym of SYMBOLS) {
    const rng = new Rng(`db-candles:${sym}`);
    const scale = 10 ** SPECS[sym].dp;
    const base = { BTCUSDT: 60000, ETHUSDT: 3000, SOLUSDT: 150, BNBUSDT: 600, XRPUSDT: 0.6, XAUUSD: 2400, EURUSD: 1.08, GBPUSD: 1.27, USDJPY: 150 }[sym];
    const data = new Int32Array(n * 5);
    let p = base;
    for (let i = 0; i < n; i++) {
      const c = p * Math.exp(rng.gauss() * 0.0008);
      data.set([Math.round(p * scale), Math.round(Math.max(p, c) * 1.0002 * scale), Math.round(Math.min(p, c) * 0.9998 * scale), Math.round(c * scale), 1], i * 5);
      p = c;
    }
    series[sym] = new MinuteSeries(sym, from, to, [{ start: from, data }]);
  }
  const market = new Market(series);
  const startMs = from + 32 * DAY;
  const endMs = to - MINUTE;
  const persona = candidatePersona(persona0, new Rng(`db-test:${leader}`));
  const sim = simulateLeader(persona, market, { startMs, endMs, seed: persona.seed });
  const { daily, equity } = buildDaily(sim, startMs, endMs);
  const followers = followerSeries(persona, daily.map(([k, r]) => [k, { start: r.start, cash: r.cash, pnl: r.pnl }]), persona.seed + 1);
  return { endMs, r: { k: 0, persona, sim, score: 0, metrics: leaderMetrics(sim), startMs, daily, equity, followers } };
}

test("writing the same history twice leaves one copy of each trade and keeps customers' copies", async () => {
  // The leader customers copied the most.
  const [leader] = await q(`select p.id, p.persona from public.providers p
                            join public.signals g on g.provider_id = p.id join public.simulated_positions sp on sp.signal_id = g.id
                            where p.is_simulated group by p.id order by count(*) desc limit 1`);
  assert.ok(leader, "a simulated leader with copied trades");
  const copied = async () =>
    (await q(`select g.id, g.hidden, g.status from public.signals g join public.simulated_positions sp on sp.signal_id = g.id
              where g.provider_id = $1 order by g.id`, [leader.id])).map((r) => `${r.id}:${r.status}`);
  const positions = async () => Number((await q(`select count(*) n from public.simulated_positions sp join public.signals g on g.id = sp.signal_id where g.provider_id = $1`, [leader.id]))[0].n);
  const copiedBefore = await copied();
  const positionsBefore = await positions();

  const { endMs, r } = syntheticBuild(leader.id, leader.persona);
  const expected = r.sim.trades.map((t) => signalId(leader.id, HISTORY_VERSION, t.no)).sort();
  const own = async () => (await q(`select g.id from public.signals g where g.provider_id = $1
                                     and not exists (select 1 from public.simulated_positions sp where sp.signal_id = g.id) order by g.id`, [leader.id])).map((x) => x.id);

  await writeBatch(db, [{ leader, r }], endMs, { savepoint: true });
  const first = await own();
  await writeBatch(db, [{ leader, r }], endMs, { savepoint: true });
  const second = await own();

  assert.deepEqual(first, expected, "exactly the built trades");
  assert.deepEqual(second, first, "a second write changes nothing");
  assert.equal(new Set(second).size, second.length, "no duplicate ids");
  assert.deepEqual(await copied(), copiedBefore, "customers' copied trades kept");
  assert.equal(await positions(), positionsBefore, "customers' positions kept");
  const [hidden] = await q(`select count(*) filter (where not g.hidden) visible from public.signals g
                            join public.simulated_positions sp on sp.signal_id = g.id where g.provider_id = $1`, [leader.id]);
  assert.equal(Number(hidden.visible), 0, "copied trades leave the public record");
  const [b] = await q("select version, trades from public.sim_history_builds where provider_id = $1", [leader.id]);
  assert.equal(b.version, HISTORY_VERSION);
  assert.equal(b.trades, r.metrics.trades);
  const ledgerTrades = Number((await q("select coalesce(sum(trades), 0) n from public.provider_daily where provider_id = $1", [leader.id]))[0].n);
  assert.equal(ledgerTrades, r.metrics.trades, "ledger rebuilt once, not added twice");
});

test("live trades open and close at the live feed price, plus / minus half the spread", async () => {
  // Every trade the live engine opened or closed after a leader's history was written.
  const rows = await q(
    `select g.id, g.symbol, g.side, g.status, g.close_trigger,
       case when g.opened_at <= b.history_to then true
            else exists (select 1 from public.price_history ph
                         where ph.symbol = g.symbol and ph.ts between g.opened_at - interval '5 minutes' and g.opened_at
                           and round(ph.price, s.dp::int) + public.trade_dir(g.side) * public.sim_half_spread(g.symbol, round(ph.price, s.dp::int)) = g.entry_price) end entry_ok,
       case when g.status <> 'closed' or g.closed_at <= b.history_to then true
            -- A level touch closes at the level; a market close at the feed (the
            -- integrity guard may still label one near a level 'tp' / 'sl').
            when g.exit_price in (g.stop_loss, g.take_profit) then true
            else exists (select 1 from public.price_history ph
                         where ph.symbol = g.symbol and ph.ts between g.closed_at - interval '5 minutes' and g.closed_at
                           and round(ph.price, s.dp::int) - public.trade_dir(g.side) * public.sim_half_spread(g.symbol, g.entry_price) = g.exit_price) end exit_ok
     from public.signals g join public.sim_history_builds b on b.provider_id = g.provider_id join public.sim_symbols s on s.symbol = g.symbol
     where not g.hidden and (g.opened_at > b.history_to or g.closed_at > b.history_to)`,
  );
  for (const r of rows) {
    assert.ok(r.entry_ok, `${r.symbol} ${r.side} ${r.id}: live entry = a feed price +/- half the spread`);
    assert.ok(r.exit_ok, `${r.symbol} ${r.side} ${r.id}: live exit (${r.close_trigger})`);
  }
});

test("anonymous visitors see the trades of the leaders whose stats they see", async () => {
  const ids = (await q("select provider_id from public.provider_stats where trades_all > 0 order by provider_id limit 20")).map((r) => r.provider_id);
  await q("select public.refresh_provider_stats($1::uuid[], false)", [ids]);
  await db.query("savepoint anon");
  await db.query("set local role anon");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
  try {
    const rows = await q(`select c.provider_id, c.closed_signals,
                            (select count(*) from public.signals s where s.provider_id = c.provider_id and s.status = 'closed') visible
                          from public.provider_cards c where c.provider_id = any($1::uuid[])`, [ids]);
    assert.ok(rows.length > 0, "anonymous visitors see leaders");
    for (const r of rows) assert.equal(Number(r.visible), Number(r.closed_signals), `leader ${r.provider_id}`);
  } finally {
    await db.query("rollback to anon");
  }
});
