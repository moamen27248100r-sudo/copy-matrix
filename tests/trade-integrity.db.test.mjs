// Database guard tests (0215-0217) against SUPABASE_DB_URL. Everything
// runs inside one transaction that is always rolled back, so no trade,
// balance or notification is persisted. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let providerId;

before(async () => {
  await db.connect();
  await db.query("begin");
  ({ rows: [{ id: providerId }] } = await db.query("select id from public.providers limit 1"));
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

// created_by_admin keeps mirror_signal_to_followers from copying the test
// trade to real followers (it would be rolled back anyway).
async function openTrade({ side, entry, sl = null, tp = null, symbol = "XAUUSD", openedAgo = "2 hours" }) {
  const { rows } = await db.query(
    `insert into public.signals (provider_id, symbol, side, entry_price, stop_loss, take_profit, status, opened_at, created_by_admin, lot_size)
     values ($1, $2, $3, $4, $5, $6, 'open', now() - $7::interval, true, 1)
     returning id, stop_loss, take_profit, needs_review`,
    [providerId, symbol, side, entry, sl, tp, openedAgo],
  );
  return rows[0];
}

async function closeTrade(id, exit, requested = "timeout") {
  const { rows } = await db.query(
    `update public.signals set status = 'closed', exit_price = $2, closed_at = now(), close_trigger = $3
     where id = $1
     returning close_trigger, (exit_price - entry_price) * public.trade_dir(side) as d`,
    [id, exit, requested],
  );
  return { trigger: rows[0].close_trigger, d: Number(rows[0].d) };
}

// Runs fn in a savepoint and expects the guard to reject it.
async function rejects(fn) {
  await db.query("savepoint t");
  try {
    await fn();
  } catch (e) {
    await db.query("rollback to savepoint t");
    assert.equal(e.code, "23514", e.message);
    return;
  }
  await db.query("rollback to savepoint t");
  assert.fail("expected the write to be rejected");
}

test("buy in profit", async () => {
  const t = await openTrade({ side: "buy", entry: 4000, sl: 3950, tp: 4100 });
  const r = await closeTrade(t.id, 4040);
  assert.ok(r.d > 0);
  assert.equal(r.trigger, "timeout");
});

test("buy at a loss", async () => {
  const t = await openTrade({ side: "buy", entry: 4000, sl: 3950, tp: 4100 });
  const r = await closeTrade(t.id, 3980);
  assert.ok(r.d < 0);
  assert.equal(r.trigger, "timeout");
});

test("sell in profit", async () => {
  const t = await openTrade({ side: "sell", entry: 4000, sl: 4050, tp: 3900 });
  const r = await closeTrade(t.id, 3950);
  assert.ok(r.d > 0);
});

test("sell at a loss", async () => {
  const t = await openTrade({ side: "sell", entry: 4000, sl: 4050, tp: 3900 });
  const r = await closeTrade(t.id, 4020);
  assert.ok(r.d < 0);
});

test("close at T/P -> 'tp' and a win", async () => {
  const t = await openTrade({ side: "buy", entry: 4000, sl: 3950, tp: 4100 });
  const r = await closeTrade(t.id, 4100);
  assert.equal(r.trigger, "tp");
  assert.ok(r.d > 0);
});

test("close at S/L -> 'sl' and a loss", async () => {
  const t = await openTrade({ side: "sell", entry: 4000, sl: 4050, tp: 3900 });
  const r = await closeTrade(t.id, 4050);
  assert.equal(r.trigger, "sl");
  assert.ok(r.d < 0);
});

test("trade without S/L and T/P", async () => {
  const t = await openTrade({ side: "buy", entry: 4000 });
  assert.equal(t.stop_loss, null);
  const r = await closeTrade(t.id, 4010, null);
  assert.equal(r.trigger, "manual");
  const t2 = await openTrade({ side: "sell", entry: 4000 });
  assert.equal((await closeTrade(t2.id, 4000.5)).trigger, "breakeven");
});

test("guard corrects: swapped S/L and T/P are swapped back", async () => {
  const t = await openTrade({ side: "buy", entry: 4000, sl: 4100, tp: 3950 });
  assert.equal(Number(t.stop_loss), 3950);
  assert.equal(Number(t.take_profit), 4100);
});

test("guard corrects: a 'tp' label on a losing close", async () => {
  const t = await openTrade({ side: "buy", entry: 4000, sl: 3950, tp: 4100 });
  const r = await closeTrade(t.id, 3980, "tp");
  assert.notEqual(r.trigger, "tp");
});

test("guard corrects: needs_review can't be self-set on insert", async () => {
  const { rows } = await db.query(
    `insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, created_by_admin, needs_review)
     values ($1, 'XAUUSD', 'buy', 4000, 'open', now() - interval '1 hour', true, true) returning needs_review`,
    [providerId],
  );
  assert.equal(rows[0].needs_review, false);
});

test("guard rejects: both levels on the same side", async () => {
  await rejects(() => openTrade({ side: "buy", entry: 4000, sl: 4100, tp: 4200 }));
});

test("guard rejects: exit past the stop loss", async () => {
  const t = await openTrade({ side: "buy", entry: 4000, sl: 3950, tp: 4100 });
  await rejects(() => closeTrade(t.id, 3900));
});

test("guard rejects: changing the side after opening", async () => {
  const t = await openTrade({ side: "buy", entry: 4000 });
  await rejects(() => db.query("update public.signals set side = 'sell' where id = $1", [t.id]));
});

test("guard rejects: closed before opened / future dates", async () => {
  const t = await openTrade({ side: "buy", entry: 4000 });
  await rejects(() =>
    db.query(
      "update public.signals set status = 'closed', exit_price = 4010, closed_at = opened_at - interval '1 minute' where id = $1",
      [t.id],
    ),
  );
  await rejects(() => openTrade({ side: "buy", entry: 4000, openedAgo: "-2 days" }));
});

test("guard rejects: non-positive and implausible prices", async () => {
  await rejects(() => openTrade({ side: "buy", entry: 4000, sl: -5 }));
  await rejects(() => openTrade({ side: "buy", entry: 50 })); // gold at $50
  await rejects(() => openTrade({ side: "buy", entry: 50000 })); // gold at $50,000
  const t = await openTrade({ side: "buy", entry: 4000 });
  await rejects(() => closeTrade(t.id, -1));
});

test("copied position: result is derived from side + prices", async () => {
  const t = await openTrade({ side: "sell", entry: 4000 });
  const { rows } = await db.query(
    `insert into public.simulated_positions (signal_id, follower_id, entry_price, exit_price, size, status, pnl, opened_at, closed_at)
     select $1, id, 4000, 4040, 1000, 'closed', 999, now() - interval '1 hour', now() from public.profiles limit 1
     returning pnl`,
    [t.id],
  );
  assert.equal(Number(rows[0].pnl), -10); // sell, price rose 1% on $1000
});

test("hidden can't be self-set and total_profit follows visible trades (0218)", async () => {
  const before = Number((await db.query("select total_profit from public.providers where id = $1", [providerId])).rows[0].total_profit);
  const { rows } = await db.query(
    `insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, lot_size, hidden)
     values ($1, 'XAUUSD', 'buy', 4001, 'open', now() - interval '1 hour', 1, true) returning id, hidden`,
    [providerId],
  );
  assert.equal(rows[0].hidden, false);
  await closeTrade(rows[0].id, 4011); // +100 pips x $10 x 1 lot
  const after = Number((await db.query("select total_profit from public.providers where id = $1", [providerId])).rows[0].total_profit);
  assert.equal(Math.round((after - before) * 100) / 100, 1000);
});

test("live engine run writes only consistent trades", async () => {
  await db.query("select public.run_market_simulation()");
  const { rows } = await db.query(
    `select i.detail, s.id from public.trade_integrity_issues() i
     join public.signals s on s.id = i.row_id
     where not i.flagged and not s.created_by_admin
       and (s.closed_at >= now() or s.opened_at >= now() - interval '1 second')`,
  );
  assert.deepEqual(rows, []);
});
