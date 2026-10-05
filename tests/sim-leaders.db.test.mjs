// Simulated leaders (0234 / 0235) against SUPABASE_DB_URL: the SQL trajectory
// matches the JS one, simulated leaders are visible and copyable on demo
// accounts only, and every stored stat equals what the trades add up to.
// Everything runs in one transaction that is rolled back. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";
import { PERSONA_KEYS, drawPersona, targetLog } from "../scripts/sim/personas.mjs";
import { Rng } from "../scripts/sim/rng.mjs";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const DEMO = "00000000-0000-4000-8000-0000000000e1";
const REAL = "00000000-0000-4000-8000-0000000000e2";
let simulated;

async function as(user, fn) {
  await db.query("savepoint s");
  if (user) {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
  } else {
    await db.query("set local role anon");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
  }
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

before(async () => {
  await db.connect();
  await db.query("begin");
  for (const [id, email] of [
    [DEMO, "sim-demo@example.test"],
    [REAL, "sim-real@example.test"],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,$2,$3,'authenticated','authenticated')", [
      id,
      email,
      JSON.stringify({ account_type: "demo" }),
    ]);
  }
  await as(REAL, () => db.query("select switch_account_type('real')"));
  await db.query("update public.profiles set balance = 50000 where id = any($1)", [[DEMO, REAL]]);
  simulated = (
    await db.query("select id from public.providers where is_simulated and persona is not null and min_copy_amount <= 1000 order by id limit 1")
  ).rows[0].id;
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

test("sim_target_log in SQL matches targetLog in JS for every persona", async () => {
  for (const key of PERSONA_KEYS) {
    for (let i = 0; i < 3; i++) {
      const persona = drawPersona(key, new Rng(`parity:${key}:${i}`), { startMs: Date.UTC(2024, 0, 1), trackDays: 300 + i * 250 });
      for (const d of [0, 3, 40, 120, 333, 700, 1200]) {
        const { rows } = await db.query("select public.sim_target_log($1::jsonb, $2)::float v", [persona.traj, d]);
        assert.ok(Math.abs(rows[0].v - targetLog(persona.traj, d)) < 1e-6, `${key} day ${d}`);
      }
    }
  }
});

test("simulated leaders are only listed for demo accounts", async () => {
  const count = async (user) =>
    as(user, async () => Number((await db.query("select count(*) n from public.provider_cards where is_simulated")).rows[0].n));
  assert.equal(await count(null), 0, "visitors");
  assert.equal(await count(REAL), 0, "real account");
  assert.ok((await count(DEMO)) > 0, "demo account");

  const trades = async (user) =>
    as(user, async () => Number((await db.query("select count(*) n from public.signals where provider_id = $1", [simulated])).rows[0].n));
  assert.equal(await trades(null), 0);
  assert.equal(await trades(REAL), 0);
  assert.ok((await trades(DEMO)) > 0);

  const series = async (user) => as(user, async () => (await db.query("select public.provider_daily_series($1) s", [simulated])).rows[0].s);
  assert.equal(await series(REAL), null);
  assert.ok((await series(DEMO)).days.length > 0);
});

test("only a demo account can copy or follow a simulated leader", async () => {
  await as(REAL, () => fails("CM050", () => db.query("select start_or_update_copy($1, 1000)", [simulated])));
  await as(REAL, () => fails("CM050", () => db.query("insert into public.follows (follower_id, provider_id) values ($1, $2)", [REAL, simulated])));
  await as(DEMO, () => db.query("select start_or_update_copy($1, 1000)", [simulated]));
  const { rows } = await db.query("select is_active from public.subscriptions where follower_id = $1 and provider_id = $2", [DEMO, simulated]);
  assert.equal(rows[0].is_active, true);
});

test("a simulated leader's trade is mirrored to demo copiers only", async () => {
  // A real-account copy can't be created through the API any more; one left
  // over from before must still receive nothing.
  await db.query(
    "insert into public.subscriptions (follower_id, provider_id, is_active, allocated_amount, copy_started_at) values ($1, $2, true, 1000, now()) on conflict (follower_id, provider_id) do update set is_active = true",
    [REAL, simulated],
  );
  const { rows } = await db.query(
    "insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, lot_size) select $1, 'BTCUSDT', 'buy', price, 'open', now() - interval '1 minute', 0.01 from public.market_prices where symbol = 'BTCUSDT' returning id",
    [simulated],
  );
  const pos = await db.query("select follower_id from public.simulated_positions where signal_id = $1", [rows[0].id]);
  const followers = pos.rows.map((r) => r.follower_id);
  assert.ok(followers.includes(DEMO));
  assert.ok(!followers.includes(REAL));
});

test("stored stats equal what the trades add up to", async () => {
  const { rows } = await db.query(`
    with t as (
      select provider_id, count(*) n, count(*) filter (where pnl_usd > 0) w, coalesce(sum(pnl_usd), 0) pnl
      from public.signals where status = 'closed' and not hidden and not created_by_admin group by provider_id
    ), d as (
      select provider_id, sum(trades) n, sum(wins) w, sum(pnl) pnl,
             (array_agg(start_equity + cash_flow + pnl order by day desc))[1] equity
      from public.provider_daily group by provider_id
    )
    select p.id, t.n tn, d.n dn, t.w tw, d.w dw, t.pnl tp, d.pnl dp, s.trades_all sn, s.pnl_all sp,
           p.total_profit, p.account_capital, d.equity
    from public.providers p
    join t on t.provider_id = p.id join d on d.provider_id = p.id join public.provider_stats s on s.provider_id = p.id
    where p.is_simulated`);
  assert.ok(rows.length >= 700);
  for (const r of rows) {
    assert.equal(Number(r.tn), Number(r.dn), `${r.id} trades by day`);
    assert.equal(Number(r.tw), Number(r.dw), `${r.id} wins by day`);
    assert.ok(Math.abs(Number(r.tp) - Number(r.dp)) < 0.05, `${r.id} pnl by day`);
    assert.ok(Math.abs(Number(r.tp) - Number(r.total_profit)) < 0.05, `${r.id} total profit`);
    assert.ok(Math.abs(Number(r.equity) - Number(r.account_capital)) < 0.05, `${r.id} equity`);
    assert.ok(Math.abs(Number(r.sp) - Number(r.tp)) < 0.05 || Number(r.sn) !== Number(r.tn), `${r.id} stats pnl`);
  }
});
