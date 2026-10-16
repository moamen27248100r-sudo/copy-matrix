// Dry run of migration 0266 (price alerts) inside ONE rolled-back transaction.
//   node scripts/check-migration-0266.mjs [--live]
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.argv.includes("--live");
const sql = readFileSync("supabase/migrations/0266_price_alerts.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const A = "00000000-0000-4000-8000-0000000002a1";
const B = "00000000-0000-4000-8000-0000000002a2";
let failed = 0;
let passed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  ok ? passed++ : failed++;
};
const q = async (s, p = []) => (await c.query(s, p)).rows;
async function as(uid, fn) {
  await c.query("savepoint s");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
  try {
    return await fn();
  } finally {
    await c.query("reset role");
  }
}
async function code(fn) {
  await c.query("savepoint e");
  try {
    await fn();
    await c.query("release savepoint e");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint e");
    return e.code;
  }
}

await c.query("begin");
try {
  if (!live) await c.query(sql);
  for (const [id, mail] of [[A, "alert-a@example.test"], [B, "alert-b@example.test"]]) {
    await c.query("insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,$2,'{\"account_type\":\"demo\"}','authenticated','authenticated')", [id, mail]);
  }
  await c.query("update public.market_prices set price = 2000 where symbol = 'XAUUSD'");

  const up = await as(A, async () => (await q("select public.create_price_alert('XAUUSD', 2100) id"))[0].id);
  const down = await as(A, async () => (await q("select public.create_price_alert('XAUUSD', 1900) id"))[0].id);
  const rows = await q("select id, direction, created_price::float cp from public.price_alerts where user_id = $1 order by target_price", [A]);
  check(rows.find((r) => r.id === up)?.direction === "above" && rows.find((r) => r.id === down)?.direction === "below", "direction comes from the price at creation");
  check(rows.every((r) => r.cp === 2000), "the price at creation is stored");

  check((await as(A, () => code(() => q("select public.create_price_alert('NOPE', 10)")))) === "CM060", "unknown instrument refused");
  check((await as(A, () => code(() => q("select public.create_price_alert('XAUUSD', 0)")))) === "CM061", "zero or negative target refused");
  check((await as(A, () => code(() => q("select public.create_price_alert('XAUUSD', 2000)")))) === "CM062", "target equal to the current price refused");
  check((await as(A, () => code(() => q("insert into public.price_alerts (user_id, symbol, direction, target_price, created_price) values ($1,'XAUUSD','above',1,1)", [A])))) === "42501", "no direct insert");
  check((await as(B, async () => (await q("select count(*)::int n from public.price_alerts"))[0].n)) === 0, "another customer sees none of them");
  check((await as(A, async () => (await q("select count(*)::int n from public.price_alerts"))[0].n)) === 2, "the owner sees both");

  // limit of 20 active
  for (let i = 0; i < 18; i++) await as(A, () => q("select public.create_price_alert('XAUUSD', $1)", [3000 + i]));
  check((await as(A, () => code(() => q("select public.create_price_alert('XAUUSD', 5000)")))) === "CM063", "at most 20 active alerts");

  // cancel: B cannot cancel A's; A can
  await as(B, () => q("select public.cancel_price_alert($1)", [down]));
  check((await q("select status from public.price_alerts where id = $1", [down]))[0].status === "active", "another customer cannot cancel it");
  await as(A, () => q("select public.cancel_price_alert($1)", [down]));
  check((await q("select status from public.price_alerts where id = $1", [down]))[0].status === "cancelled", "the owner cancels it");

  // the price crosses 2100: only the 'above 2100' alert fires, once
  await c.query("update public.market_prices set price = 2105.5 where symbol = 'XAUUSD'");
  const fired = (await q("select public.evaluate_price_alerts() n"))[0].n;
  check(fired === 1, `one alert fired (${fired})`);
  const t = (await q("select status, triggered_price::float p from public.price_alerts where id = $1", [up]))[0];
  check(t.status === "triggered" && t.p === 2105.5, "marked triggered at the price that crossed");
  const n = await q("select type, account_type, data from public.notifications where user_id = $1 and type = 'market_price_alert'", [A]);
  check(n.length === 1 && n[0].data.symbol === "XAUUSD" && Number(n[0].data.target) === 2100 && n[0].data.direction === "above", "one notification with symbol, target and direction");
  check(n[0]?.account_type == null, "the notice belongs to both accounts");
  check((await q("select public.notification_category('market_price_alert') c"))[0].c === "market", "category market (switchable in the settings)");
  check((await q("select public.evaluate_price_alerts() n"))[0].n === 0, "it does not fire twice");
  check((await q("select count(*)::int n from cron.job where jobname = 'evaluate-price-alerts'"))[0].n === 1, "scheduled every minute");
} finally {
  await c.query("rollback");
  await c.end();
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed`);
process.exitCode = failed ? 1 : 0;
