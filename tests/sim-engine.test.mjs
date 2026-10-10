// Leader simulator (scripts/sim): no trade looks ahead, every price comes from
// the candles, exits are the first touch of a level or the time stop, the
// same seed rebuilds the same history, and the ledger adds up to the trades.
// Runs on synthetic 1-minute candles, so it needs no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MinuteSeries, SYMBOLS, MINUTE, DAY } from "../scripts/sim/candles.mjs";
import { Market, simulateLeader, halfSpread, marketOpen, grossCents, drawdownBrake, SPECS } from "../scripts/sim/engine.mjs";
import { PERSONA_KEYS, drawPersona } from "../scripts/sim/personas.mjs";
import { buildDaily, signalId } from "../scripts/sim/rebuild.mjs";
import { Rng } from "../scripts/sim/rng.mjs";

const FROM = Date.UTC(2025, 0, 1);
const TO = Date.UTC(2025, 2, 15);
const N = (TO - FROM) / MINUTE;
const BASE = { BTCUSDT: 60000, ETHUSDT: 3000, SOLUSDT: 150, BNBUSDT: 600, XRPUSDT: 0.6, XAUUSD: 2400, EURUSD: 1.08, GBPUSD: 1.27, USDJPY: 150 };

// A random-walk minute series per symbol; `shockFrom` (ms) changes every
// candle from that minute on.
function syntheticMarket(shockFrom = Infinity) {
  const series = {};
  for (const sym of SYMBOLS) {
    const rng = new Rng(`candles:${sym}`);
    const shock = new Rng(`shock:${sym}`);
    const scale = 10 ** SPECS[sym].dp;
    const data = new Int32Array(N * 5);
    let p = BASE[sym];
    for (let i = 0; i < N; i++) {
      const t = FROM + i * MINUTE;
      const g = rng.gauss();
      const after = t >= shockFrom;
      const o = p;
      const c = o * Math.exp((after ? shock.gauss() : g) * 0.0008);
      const h = Math.max(o, c) * (1 + Math.abs(rng.gauss()) * 0.0003);
      const l = Math.min(o, c) * (1 - Math.abs(rng.gauss()) * 0.0003);
      data.set([Math.round(o * scale), Math.round(h * scale), Math.round(l * scale), Math.round(c * scale), 1], i * 5);
      p = c;
    }
    series[sym] = new MinuteSeries(sym, FROM, TO, [{ start: FROM, data }]);
  }
  return new Market(series);
}

const market = syntheticMarket();
const START = FROM + 35 * DAY;
const END = TO - MINUTE;

function run(key, label, m = market) {
  const persona = drawPersona(key, new Rng(label), { startMs: START, trackDays: (END - START) / DAY });
  return { persona, sim: simulateLeader(persona, m, { startMs: START, endMs: END, seed: persona.seed }) };
}

const decision = (t) => [t.no, t.sym, t.side, t.openMs, t.entry, t.sl, t.tp, t.lot, t.holdMin];

test("the same seed rebuilds exactly the same trades", () => {
  for (const key of ["gold_scalper", "swing_trend", "gambler"]) {
    const a = run(key, `test:${key}`);
    const b = run(key, `test:${key}`);
    assert.deepEqual(a.persona, b.persona);
    assert.deepEqual(a.sim.trades.map(decision), b.sim.trades.map(decision));
    assert.deepEqual(a.sim.trades.map((t) => [t.exit, t.exitMs, t.pnl]), b.sim.trades.map((t) => [t.exit, t.exitMs, t.pnl]));
  }
});

test("no look-ahead: changing the prices after T changes no trade opened before T", () => {
  const T = START + 12 * DAY;
  const shocked = syntheticMarket(T);
  for (const key of ["crypto_day", "fx_day", "swing_trend", "crypto_scalper"]) {
    const a = run(key, `lookahead:${key}`);
    const b = run(key, `lookahead:${key}`, shocked);
    const before = (s) => s.trades.filter((t) => t.openMs < T).map(decision);
    assert.ok(before(a.sim).length > 0, `${key} traded before T`);
    assert.deepEqual(before(a.sim), before(b.sim), `${key}: decisions before T unchanged`);
    // Trades that also closed before T closed the same way.
    const closedBefore = (s) => s.trades.filter((t) => !t.stillOpen && t.exitMs < T).map((t) => [t.no, t.exit, t.exitMs, t.pnl]);
    assert.deepEqual(closedBefore(a.sim), closedBefore(b.sim));
    // And the shock did change the later history.
    assert.notDeepEqual(a.sim.trades.map(decision), b.sim.trades.map(decision));
  }
});

test("every trade opens at the candle's price and closes at the first touch or the time stop", () => {
  for (const key of PERSONA_KEYS) {
    const { sim } = run(key, `consistency:${key}`);
    assert.ok(sim.trades.length > 0, `${key} traded`);
    for (const t of sim.trades) {
      const ser = market.s[t.sym];
      const open = market.open[t.sym];
      const i0 = ser.index(t.openMs);
      const half = halfSpread(t.sym, ser.o[i0]);
      assert.equal(t.openMs, ser.time(i0), "opens on a minute");
      assert.ok(ser.real[i0] && open[i0], `${key}: opens on a traded minute of an open market`);
      assert.equal(t.entry, ser.o[i0] + t.dir * half, `${key}: entry = open +/- half spread`);
      assert.ok((t.entry - t.sl) * t.dir > 0 && (t.tp - t.entry) * t.dir > 0, `${key}: levels on the right side`);
      assert.ok(t.lot > 0);
      if (t.stillOpen) continue;
      const iE = ser.index(t.exitMs);
      assert.ok(open[iE], `${key}: closes while the market is open`);
      // Exit-side extremes of a minute.
      const adverse = (i) => (t.dir > 0 ? ser.l[i] : ser.h[i]) - t.dir * half;
      const favour = (i) => (t.dir > 0 ? ser.h[i] : ser.l[i]) - t.dir * half;
      const touched = (i) => open[i] && ((adverse(i) - t.sl) * t.dir <= 0 || (favour(i) - t.tp) * t.dir >= 0);
      for (let i = i0; i < iE; i++) assert.ok(!touched(i), `${key}: no level touched before the exit`);
      if (t.trigger === "sl") assert.ok(t.exit === t.sl && (adverse(iE) - t.sl) * t.dir <= 0, `${key}: stop at the level`);
      else if (t.trigger === "tp") assert.ok(t.exit === t.tp && (favour(iE) - t.tp) * t.dir >= 0 && (adverse(iE) - t.sl) * t.dir > 0, `${key}: target at the level`);
      else {
        assert.equal(t.exit, ser.o[iE] - t.dir * half, `${key}: market exit at the open less half the spread`);
        if (t.trigger === "timeout") assert.ok(iE >= i0 + t.holdMin, `${key}: time stop after the holding time`);
        else assert.ok(!open[iE + 5], `${key}: flat before the market closes`);
      }
      const move = (t.exit - t.entry) * t.dir;
      assert.ok(move <= (t.tp - t.entry) * t.dir && move >= -(t.entry - t.sl) * t.dir, `${key}: exit inside the levels`);
      assert.equal(t.gross, grossCents(t.sym, t.dir, t.entry, t.exit, t.lot));
      assert.equal(t.pnl, t.gross - t.commission + t.swap);
      assert.ok(Number.isInteger(t.pnl) && Number.isInteger(t.commission) && Number.isInteger(t.swap), "money in whole cents");
    }
  }
});

test("gold and forex never open while their market is closed", () => {
  for (const key of ["gold_scalper", "fx_day", "macro", "position_conservative"]) {
    const { sim } = run(key, `hours:${key}`);
    for (const t of sim.trades) if (SPECS[t.sym].kind !== "crypto") assert.ok(marketOpen(t.sym, t.openMs), `${key} ${t.sym} ${new Date(t.openMs).toISOString()}`);
  }
});

test("drawdown brake: full risk, half, quarter, then a pause after a recent close", () => {
  const p = { dd: [0.1, 0.3] };
  assert.equal(drawdownBrake(p, 0.05, 0), 1);
  assert.equal(drawdownBrake(p, 0.15, 0), 0.5);
  assert.equal(drawdownBrake(p, 0.28, 3 * DAY), 0);
  assert.equal(drawdownBrake(p, 0.28, 8 * DAY), 0.25);
});

test("the daily ledger adds up to the trades and cash flows", () => {
  const { sim } = run("crypto_day", "ledger");
  const { daily, equity } = buildDaily(sim, START, END);
  const closed = sim.trades.filter((t) => !t.stillOpen);
  assert.equal(daily.reduce((a, [, r]) => a + r.trades, 0), closed.length);
  assert.equal(daily.reduce((a, [, r]) => a + r.pnl, 0), closed.reduce((a, t) => a + t.pnl, 0));
  assert.equal(daily.reduce((a, [, r]) => a + r.cash, 0), sim.cashFlows.reduce((a, c) => a + c.amount, 0));
  let eq = 0;
  for (const [, r] of daily) {
    assert.equal(r.start, eq);
    eq = r.start + r.cash + r.pnl;
  }
  assert.equal(equity, eq);
  assert.equal(equity, sim.equity);
});

test("trade ids are deterministic and distinct", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(signalId(id, 2, 7), signalId(id, 2, 7));
  assert.notEqual(signalId(id, 2, 7), signalId(id, 2, 8));
  assert.notEqual(signalId(id, 2, 7), signalId(id, 3, 7));
  assert.match(signalId(id, 2, 7), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
