// Dry run of migration 0260 inside ONE rolled-back transaction.   node scripts/check-migration-0260.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const sql = readFileSync("supabase/migrations/0260_push_notifications.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  await c.query(sql);
  const u = (await c.query("select id from profiles where email = 'mo48100r@gmail.com'")).rows[0]?.id;
  if (!u) throw new Error("fixture: test user missing");
  await c.query("delete from notification_preferences where user_id = $1", [u]);

  const count = async () => Number((await c.query("select count(*) n from push_outbox where user_id = $1", [u])).rows[0].n);
  await c.query("insert into notifications (user_id, type, title, body, data) values ($1, 'kyc_approved', 't', null, '{}'::jsonb)", [u]);
  ok("no subscription: nothing is queued", (await count()) === 0);

  await c.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/test-1', 'k', 'a')", [u]);
  await c.query("insert into notifications (user_id, type, title, body, data) values ($1, 'kyc_approved', 't', null, '{}'::jsonb)", [u]);
  ok("with a device: the notification is queued once", (await count()) === 1);

  await c.query("insert into notification_preferences (user_id, category, in_app, email) values ($1, 'account', false, false)", [u]);
  await c.query("insert into notifications (user_id, type, title, body, data) values ($1, 'kyc_approved', 't', null, '{}'::jsonb)", [u]);
  ok("a category switched off in the app is not pushed", (await count()) === 1);

  await c.query("select fire_push_dispatch()");
  ok("dispatch runs without secrets and without error", true);

  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)", [u]);
  const own = Number((await c.query("select count(*) n from push_subscriptions")).rows[0].n);
  ok("a customer reads own subscription rows", own === 1, own);
  await c.query("savepoint s1");
  let hidden = false;
  try {
    await c.query("select p256dh from push_subscriptions");
  } catch (e) {
    hidden = /permission denied/i.test(e.message);
  }
  await c.query("rollback to savepoint s1");
  ok("the device keys are not readable by the customer", hidden);
  await c.query("savepoint s2");
  let noInsert = false;
  try {
    await c.query("insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/x', 'k', 'a')", [u]);
  } catch (e) {
    noInsert = /permission denied/i.test(e.message);
  }
  await c.query("rollback to savepoint s2");
  ok("a customer cannot write subscriptions directly", noInsert);
  await c.query("savepoint s3");
  let noOutbox = false;
  try {
    await c.query("select * from push_outbox");
  } catch (e) {
    noOutbox = /permission denied/i.test(e.message);
  }
  await c.query("rollback to savepoint s3");
  ok("the outbox is closed to customers", noOutbox);
  await c.query("reset role");
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_proc where proname = 'fire_push_dispatch'")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", still);
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
