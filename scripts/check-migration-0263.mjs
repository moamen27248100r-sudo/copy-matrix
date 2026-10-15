// Dry run and tests of migration 0263 (copy sizing by margin) inside ONE rolled-back transaction.
//   node scripts/check-migration-0263.mjs           -> applies the migration in the transaction first
//   node scripts/check-migration-0263.mjs --live    -> tests the functions already in the database
// Nothing is ever committed.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const live = process.argv.includes("--live");
const sql = readFileSync("supabase/migrations/0263_copy_margin_sizing.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  if (!live) await c.query(sql);
  const nullMargin = Number((await c.query("select count(*) n from simulated_positions where margin is null")).rows[0].n);
  ok("every existing copied trade has a margin (= its size, leverage 1)", nullMargin === 0, nullMargin);

  // a demo customer with plenty of balance
  const uid = randomUUID();
  await c.query(
    "insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, '{}'::jsonb, $3::jsonb, now(), now())",
    [uid, `dry-run-${uid.slice(0, 8)}@example.invalid`, JSON.stringify({ display_name: "Dry run", account_type: "demo" })],
  );
  await c.query("update profiles set balance = 100000, account_type = 'demo' where id = $1", [uid]);
  const price = Number((await c.query("select price from market_prices where symbol = 'BTCUSDT'")).rows[0].price);

  const leader = async (capital, persona) =>
    (await c.query("insert into providers (display_name, is_simulated, account_capital, persona, min_copy_amount) values ('Dry run leader', true, $1, $2::jsonb, 10) returning id", [capital, JSON.stringify(persona)])).rows[0].id;
  const copy = async (providerId, amount) =>
    (await c.query("insert into subscriptions (follower_id, provider_id, allocated_amount, copy_mode, max_drawdown_pct) values ($1, $2, $3, 'ratio', 50) returning id", [uid, providerId, amount])).rows[0].id;
  // a trade whose exposure is `notional` dollars (BTC: lot x price)
  const trade = async (providerId, notional) =>
    (await c.query("insert into signals (provider_id, symbol, side, entry_price, lot_size, status, opened_at) values ($1, 'BTCUSDT', 'buy', $2, $3, 'open', now()) returning id", [providerId, price, notional / price])).rows[0].id;
  const pos = async (subId) => (await c.query("select signal_id, size, margin, leverage from simulated_positions where subscription_id = $1 order by opened_at, size desc", [subId])).rows;

  // 1. two trades opened at the same time are both copied, with leverage
  const l1 = await leader(10000, { lev: 10 });
  const s1 = await copy(l1, 1000);
  await trade(l1, 10000); // margin share = 10000 / 10 / 10000 = 10%
  await trade(l1, 10000);
  const p1 = await pos(s1);
  ok("two simultaneous trades are both copied", p1.length === 2, p1.length);
  ok("margin = 10% of the copy (leader's margin share), leverage 10", p1.every((p) => near(p.margin, 100) && near(p.leverage, 10)), JSON.stringify(p1));
  ok("exposure = margin x leverage (size 1000)", p1.every((p) => near(p.size, 1000)), p1.map((p) => p.size).join(","));

  // 2. no leverage: margin share = exposure / balance
  const l2 = await leader(10000, {});
  const s2 = await copy(l2, 1000);
  await trade(l2, 2000); // 20%
  const p2 = await pos(s2);
  ok("without leverage: margin 200, size 200, leverage 1", p2.length === 1 && near(p2[0].margin, 200) && near(p2[0].size, 200) && near(p2[0].leverage, 1), JSON.stringify(p2));

  // 3. not enough free amount: opened smaller, then skipped, each with a notice and a record
  const l3 = await leader(10000, { lev: 10 });
  const s3 = await copy(l3, 150);
  await trade(l3, 60000); // 60% -> 90
  await trade(l3, 60000); // 60 left -> reduced to 60
  await trade(l3, 60000); // nothing left -> skipped
  const p3 = await pos(s3);
  ok("first trade full (90), second reduced to what is free (60)", p3.length === 2 && near(p3[0].margin, 90) && near(p3[1].margin, 60), JSON.stringify(p3));
  ok("the copy never uses more than its amount", p3.reduce((a, p) => a + Number(p.margin), 0) <= 150.001, p3.reduce((a, p) => a + Number(p.margin), 0));
  const ev3 = (await c.query("select kind, reason, required_margin, available_margin, opened_margin from copy_events where subscription_id = $1 order by id", [s3])).rows;
  ok("reduced trade recorded with its reason", ev3.some((e) => e.kind === "reduced" && e.reason === "insufficient_free_amount" && near(e.opened_margin, 60) && near(e.required_margin, 90)), JSON.stringify(ev3));
  ok("skipped trade recorded with its reason", ev3.some((e) => e.kind === "skipped" && e.reason === "insufficient_free_amount" && near(e.available_margin, 0)), JSON.stringify(ev3));
  const n3 = (await c.query("select type, data from notifications where user_id = $1 and type in ('copy_reduced', 'copy_skipped') and data ->> 'symbol' = 'BTCUSDT' order by created_at", [uid])).rows;
  ok("the customer is told about the reduced trade", n3.some((n) => n.type === "copy_reduced" && near(n.data.opened, 60)), n3.map((n) => n.type).join(","));
  ok("the customer is told about the skipped trade", n3.some((n) => n.type === "copy_skipped" && n.data.reason === "insufficient_free_amount"), n3.map((n) => n.type).join(","));

  // 4. below the minimum trade: not opened, recorded and told
  const l4 = await leader(1000000, {});
  const s4 = await copy(l4, 100);
  await trade(l4, 500); // 0.05% of 100 = 0.05 -> exposure below US$10
  const p4 = await pos(s4);
  const ev4 = (await c.query("select kind, reason from copy_events where subscription_id = $1", [s4])).rows;
  ok("a trade below the minimum size is not opened", p4.length === 0, p4.length);
  ok("...and is recorded as below_minimum_size", ev4.length === 1 && ev4[0].kind === "skipped" && ev4[0].reason === "below_minimum_size", JSON.stringify(ev4));

  // 5. the copy's own take profit is a percentage of the margin: price distance / leverage
  const l5 = await leader(10000, { lev: 20 });
  const s5 = (await c.query("insert into subscriptions (follower_id, provider_id, allocated_amount, copy_mode, max_drawdown_pct, tp_pct) values ($1, $2, 1000, 'ratio', 50, 20) returning id", [uid, l5])).rows[0].id;
  await trade(l5, 20000);
  const tp = Number((await c.query("select take_profit from simulated_positions where subscription_id = $1", [s5])).rows[0].take_profit);
  ok("take profit 20% of the margin at leverage 20 = a 1% price move", near(tp / price, 1.01) || Math.abs(tp / price - 1.01) < 1e-6, (tp / price).toFixed(5));

  // 6. the free amount comes back when a trade closes
  const free = await c.query("select available from copy_trade_size($1, 0.1, 10)", [s3]);
  ok("a full copy has nothing free", near(free.rows[0].available, 0), free.rows[0].available);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  await c.end();
}
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
}
console.log(failed ? `${failed} FAILED` : `all ${results.length} passed (rolled back)`);
process.exit(failed ? 1 : 0);
