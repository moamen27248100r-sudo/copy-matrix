// Copy trade-risk settings (0230) against SUPABASE_DB_URL: TP / SL / trailing stop,
// copying the leader's open trades, editing settings, validation. Runs for a demo
// and a real account. Everything is inside one transaction that is always rolled
// back, so no data is left behind. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const DEMO = "00000000-0000-4000-8000-0000000000d1";
const REAL = "00000000-0000-4000-8000-0000000000d2";
const SYMBOL = "XAUUSD";
let provider;

async function as(user, fn) {
  await db.query("savepoint s");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}

async function fails(code, fn) {
  await db.query("savepoint f");
  await assert.rejects(fn, (e) => e.code === code);
  await db.query("rollback to f");
}

const setPrice = (p) => db.query("update public.market_prices set price=$1 where symbol=$2", [p, SYMBOL]);
const price = async () => Number((await db.query("select price from public.market_prices where symbol=$1", [SYMBOL])).rows[0].price);
const balance = async (u) => (await db.query("select balance::float b, other_balance::float o from public.profiles where id=$1", [u])).rows[0];
const sub = async (u) => (await db.query("select * from public.subscriptions where follower_id=$1 and provider_id=$2", [u, provider])).rows[0];

async function startCopy(user, args = {}) {
  const a = { amount: 1000, mode: "ratio", fixed: null, max: null, copySl: null, tp: null, sl: null, trail: null, open: false, ...args };
  return as(user, () =>
    db.query("select start_or_update_copy($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [provider, a.amount, a.mode, a.fixed, a.max, a.copySl, a.tp, a.sl, a.trail, a.open]),
  );
}

// A leader trade at the given price (the AFTER INSERT trigger mirrors it to copiers).
async function leaderTrade(side, entry) {
  const { rows } = await db.query(
    "insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, lot_size) values ($1,$2,$3,$4,'open', now() - interval '2 hours', 0.01) returning id",
    [provider, SYMBOL, side, entry],
  );
  return rows[0].id;
}

async function position(signalId, user) {
  const { rows } = await db.query(
    "select id, entry_price::float ep, size::float size, take_profit::float tp, stop_loss::float sl, trail_pct::float trail, best_price::float best, status, pnl::float pnl, exit_price::float xp, account_type from public.simulated_positions where signal_id=$1 and follower_id=$2",
    [signalId, user],
  );
  return rows[0];
}

// Positions are opened "now"; backdate so a same-transaction close is valid.
const age = (id) => db.query("update public.simulated_positions set opened_at = now() - interval '1 hour' where id=$1", [id]);

// Close the user's other copies first so tests only see their own positions.
async function reset(user) {
  await db.query("delete from public.simulated_positions where follower_id=$1", [user]);
  await db.query("delete from public.subscriptions where follower_id=$1", [user]);
}

before(async () => {
  await db.connect();
  await db.query("begin");
  for (const [id, email, type] of [
    [DEMO, "risk-demo@example.test", "demo"],
    [REAL, "risk-real@example.test", "demo"],
  ]) {
    await db.query(
      "insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,$2,$3,'authenticated','authenticated')",
      [id, email, JSON.stringify({ account_type: type })],
    );
  }
  await as(REAL, () => db.query("select switch_account_type('real')"));
  await db.query("update public.profiles set balance = 5000 where id=$1", [REAL]);
  // A real (non-simulated) leader of its own: simulated leaders can only be
  // copied from demo accounts (0235), and both account types are tested here.
  const { rows } = await db.query(
    "insert into public.providers (display_name, min_copy_amount, trading_status, is_simulated) values ('Copy Risk Test Leader', 100, 'active', false) returning id",
  );
  provider = rows[0].id;
  // No other open trades of this leader, so only the ones created here exist.
  await db.query("alter table public.signals disable trigger on_signal_closed");
  await db.query("update public.signals set status='closed', exit_price=entry_price, closed_at=now() where provider_id=$1 and status='open'", [provider]);
  await db.query("alter table public.signals enable trigger on_signal_closed");
  await setPrice(4000);
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

test("settings are validated on the server with a distinct error per field", async () => {
  await as(DEMO, async () => {
    await fails("CM018", () => db.query("select start_or_update_copy($1,1000,'ratio',null,null,null,0.5,null,null,false)", [provider]));
    await fails("CM018", () => db.query("select start_or_update_copy($1,1000,'ratio',null,null,null,501,null,null,false)", [provider]));
    await fails("CM019", () => db.query("select start_or_update_copy($1,1000,'ratio',null,null,null,null,0,null,false)", [provider]));
    await fails("CM019", () => db.query("select start_or_update_copy($1,1000,'ratio',null,null,null,null,91,null,false)", [provider]));
    await fails("CM020", () => db.query("select start_or_update_copy($1,1000,'ratio',null,null,null,null,null,0.1,false)", [provider]));
    await fails("CM020", () => db.query("select start_or_update_copy($1,1000,'ratio',null,null,null,null,null,51,false)", [provider]));
    await fails("CM021", () => db.query("select update_copy_risk_settings($1,5,5,null,false)", [provider]));
  });
  assert.equal(await sub(DEMO), undefined);
});

test("settings are saved on the copy and can be edited afterwards", async () => {
  await startCopy(DEMO, { tp: 10, sl: 5, trail: 2 });
  let s = await sub(DEMO);
  assert.deepEqual([Number(s.tp_pct), Number(s.sl_pct), Number(s.trailing_pct)], [10, 5, 2]);
  await as(DEMO, async () => {
    await fails("CM019", () => db.query("select update_copy_risk_settings($1,10,95,null,false)", [provider]));
    await db.query("select update_copy_risk_settings($1,20,null,1.5,false)", [provider]);
  });
  s = await sub(DEMO);
  assert.deepEqual([Number(s.tp_pct), s.sl_pct, Number(s.trailing_pct)], [20, null, 1.5]);
  await reset(DEMO);
});

for (const [label, user] of [
  ["demo", DEMO],
  ["real", REAL],
]) {
  test(`${label}: take-profit closes a buy and a sell at the target`, async () => {
    await setPrice(4000);
    await startCopy(user, { tp: 5, sl: 3, mode: "fixed", fixed: 500 }); // two trades of 500 each
    const buy = await leaderTrade("buy", 4000);
    const sell = await leaderTrade("sell", 4000);
    const b = await position(buy, user);
    const s = await position(sell, user);
    assert.equal(b.size, 500);
    assert.equal(b.account_type, label);
    assert.equal(b.tp, 4200); // +5% of margin
    assert.equal(b.sl, 3880); // -3%
    assert.equal(s.tp, 3800);
    assert.equal(s.sl, 4120);
    await age(b.id);
    await age(s.id);
    const before = (await balance(user)).b;

    await setPrice(4100); // inside the band: nothing closes
    assert.equal((await position(buy, user)).status, "open");

    await setPrice(4210); // buy TP hit (and the sell is past its SL 4120)
    const b2 = await position(buy, user);
    const s2 = await position(sell, user);
    assert.equal(b2.status, "closed");
    assert.equal(b2.pnl, 26.25); // (4210-4000)/4000 * 500
    assert.equal(s2.status, "closed");
    assert.equal(s2.pnl, -26.25);
    assert.equal((await balance(user)).b, before);
    await reset(user);
  });

  test(`${label}: stop-loss closes at the loss and credits the right wallet`, async () => {
    await setPrice(4000);
    await startCopy(user, { sl: 3 });
    const buy = await leaderTrade("buy", 4000);
    const p = await position(buy, user);
    assert.equal(p.tp, null);
    await age(p.id);
    const w = await balance(user);
    await setPrice(3870); // below 3880
    const c = await position(buy, user);
    assert.equal(c.status, "closed");
    assert.equal(c.pnl, -32.5);
    const w2 = await balance(user);
    assert.equal(w2.b, w.b - 32.5);
    assert.equal(w2.o, w.o); // the other account's wallet is untouched
    await reset(user);
  });

  test(`${label}: trailing stop follows the best price then closes on the retrace`, async () => {
    await setPrice(4000);
    await startCopy(user, { trail: 3, mode: "fixed", fixed: 500 });
    const buy = await leaderTrade("buy", 4000);
    const sell = await leaderTrade("sell", 4000);
    const b = await position(buy, user);
    const s = await position(sell, user);
    assert.equal(b.trail, 3);
    assert.equal(b.best, 4000);
    await age(b.id);
    await age(s.id);

    await setPrice(4400);
    assert.equal((await position(buy, user)).best, 4400);
    await setPrice(4300); // -2.3% from the best: still open
    assert.equal((await position(buy, user)).status, "open");
    assert.equal((await position(buy, user)).best, 4400);
    await setPrice(4500);
    assert.equal((await position(buy, user)).best, 4500);
    await setPrice(4400); // -2.2%: still open
    assert.equal((await position(buy, user)).status, "open");
    await setPrice(4360); // 4500 * 0.97 = 4365 -> closed
    const c = await position(buy, user);
    assert.equal(c.status, "closed");
    assert.equal(c.pnl, 45); // (4360-4000)/4000 * 500
    // The sell side tracked the lowest price instead; it stopped out on the way up.
    const sc = await position(sell, user);
    assert.equal(sc.status, "closed");
    await reset(user);
  });

  test(`${label}: copying open trades uses the market price and the new settings`, async () => {
    await setPrice(4000);
    const open = await leaderTrade("buy", 3900); // the leader entered lower
    await startCopy(user, { tp: 5, sl: 4, trail: 2, open: true });
    const p = await position(open, user);
    assert.ok(p, "open leader trade copied");
    assert.equal(p.ep, 4000); // current market price, not the leader's entry
    assert.equal(p.size, 1000);
    assert.equal(p.tp, 4200);
    assert.equal(p.sl, 3840);
    assert.equal(p.trail, 2);
    assert.equal(p.best, 4000);
    await reset(user);
    await db.query("update public.signals set status='closed', exit_price=entry_price, closed_at=now() where id=$1", [open]);
  });
}

test("without the option, open leader trades are not copied", async () => {
  await setPrice(4000);
  const open = await leaderTrade("buy", 3950);
  await startCopy(DEMO, { open: false });
  assert.equal(await position(open, DEMO), undefined);
  await reset(DEMO);
  await db.query("update public.signals set status='closed', exit_price=entry_price, closed_at=now() where id=$1", [open]);
});

test("editing settings can re-apply them to positions that are already open", async () => {
  await setPrice(4000);
  await startCopy(DEMO, { tp: 5, mode: "fixed", fixed: 500 });
  const t1 = await leaderTrade("buy", 4000);
  await as(DEMO, () => db.query("select update_copy_risk_settings($1,10,2,1,false)", [provider]));
  assert.equal((await position(t1, DEMO)).tp, 4200); // existing trade keeps its old target
  const t2 = await leaderTrade("buy", 4000);
  const p2 = await position(t2, DEMO);
  assert.equal(p2.tp, 4400); // new trades use the new ones
  assert.equal(p2.sl, 3920);
  assert.equal(p2.trail, 1);
  await as(DEMO, () => db.query("select update_copy_risk_settings($1,10,2,1,true)", [provider]));
  const p1 = await position(t1, DEMO);
  assert.equal(p1.tp, 4400);
  assert.equal(p1.sl, 3920);
  assert.equal(p1.trail, 1);
  assert.equal(await price(), 4000);
  await reset(DEMO);
});
