// Leader simulator: the same seed rebuilds the same history, and every trade
// is internally consistent (levels, exit inside the levels, P&L from prices).
// Runs on synthetic hourly candles, so it needs no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { HourlySeries, SYMBOLS, HOUR } from "../scripts/sim/candles.mjs";
import { PriceBook, simulateLeader, grossPnl } from "../scripts/sim/engine.mjs";
import { PERSONA_KEYS, drawPersona, targetLog } from "../scripts/sim/personas.mjs";
import { Rng } from "../scripts/sim/rng.mjs";

const FROM = Date.UTC(2025, 0, 1);
const TO = Date.UTC(2025, 6, 1);
const BASE = { BTCUSDT: 60000, ETHUSDT: 3000, SOLUSDT: 150, BNBUSDT: 600, XRPUSDT: 0.6, XAUUSD: 2400, EURUSD: 1.08, GBPUSD: 1.27, USDJPY: 150 };

function syntheticBook() {
  const series = {};
  for (const sym of SYMBOLS) {
    const rng = new Rng(`candles:${sym}`);
    const rows = [];
    let p = BASE[sym];
    for (let t = FROM; t < TO; t += HOUR) {
      const o = p;
      const c = o * Math.exp(rng.gauss() * 0.004);
      const h = Math.max(o, c) * (1 + Math.abs(rng.gauss()) * 0.0015);
      const l = Math.min(o, c) * (1 - Math.abs(rng.gauss()) * 0.0015);
      rows.push([t, o, h, l, c]);
      p = c;
    }
    series[sym] = new HourlySeries(rows, FROM, TO);
  }
  return new PriceBook(series);
}

const book = syntheticBook();
const START = FROM + 35 * 86400000;

function run(key, seedLabel) {
  const persona = drawPersona(key, new Rng(seedLabel), { startMs: START, trackDays: (TO - START) / 86400000 });
  return { persona, sim: simulateLeader(persona, book, { startMs: START, endMs: TO - HOUR, seed: persona.seed }) };
}

test("the same seed rebuilds exactly the same trades", () => {
  for (const key of ["gold_scalper", "swing_trend", "gambler"]) {
    const a = run(key, `test:${key}`);
    const b = run(key, `test:${key}`);
    assert.deepEqual(a.persona, b.persona);
    assert.equal(a.sim.trades.length, b.sim.trades.length);
    assert.deepEqual(
      a.sim.trades.map((t) => [t.sym, t.side, t.entry, t.exit, t.lot, t.openMs, t.exitMs]),
      b.sim.trades.map((t) => [t.sym, t.side, t.entry, t.exit, t.lot, t.openMs, t.exitMs]),
    );
  }
});

test("a different seed gives a different history", () => {
  const a = run("fx_day", "test:a");
  const b = run("fx_day", "test:b");
  assert.notDeepEqual(
    a.sim.trades.slice(0, 20).map((t) => [t.entry, t.openMs]),
    b.sim.trades.slice(0, 20).map((t) => [t.entry, t.openMs]),
  );
});

test("every persona produces consistent trades", () => {
  for (const key of PERSONA_KEYS) {
    const { sim } = run(key, `consistency:${key}`);
    assert.ok(sim.trades.length > 0, `${key} traded`);
    for (const t of sim.trades) {
      // Stop loss below and take profit above the entry for a buy, the reverse for a sell.
      assert.ok((t.entry - t.sl) * t.dir > 0 && (t.tp - t.entry) * t.dir > 0, `${key} levels`);
      assert.ok(t.lot > 0);
      if (t.stillOpen) continue;
      assert.ok(t.exitMs > t.openMs, `${key} closes after it opens`);
      const move = (t.exit - t.entry) * t.dir;
      assert.ok(move <= (t.tp - t.entry) * t.dir + 1e-9 && move >= -(t.entry - t.sl) * t.dir - 1e-9, `${key} exit inside levels`);
      assert.equal(t.gross, grossPnl(t.sym, t.dir, t.entry, t.exit, t.lot));
      assert.equal(t.pnl, Math.round((t.gross - t.commission + t.swap) * 100) / 100);
    }
  }
});

test("trajectory targets are continuous and start at zero", () => {
  for (const key of PERSONA_KEYS) {
    const persona = drawPersona(key, new Rng(`traj:${key}`), { startMs: START, trackDays: 600 });
    assert.ok(Math.abs(targetLog(persona.traj, 0)) < 1e-9, `${key} starts at 0`);
    for (let d = 1; d < 900; d++) {
      assert.ok(Math.abs(targetLog(persona.traj, d) - targetLog(persona.traj, d - 1)) < 0.15, `${key} smooth at day ${d}`);
    }
  }
});
