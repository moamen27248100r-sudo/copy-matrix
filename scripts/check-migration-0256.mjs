// Dry run of migration 0256 (notification policy) inside ONE transaction that is ALWAYS rolled back.
//   node scripts/check-migration-0256.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const sql = readFileSync("supabase/migrations/0256_notification_policy.sql", "utf8")
  .replace(/^begin;\s*$/m, "-- begin")
  .replace(/^commit;\s*$/m, "-- commit");

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  const run = (q, p) => c.query(q, p);
  await run(sql);

  // A customer with an active copy (used for the subscription / leader-stop checks).
  const sub = (
    await run(
      `select s.id, s.follower_id, s.provider_id, p.account_type
       from subscriptions s join profiles p on p.id = s.follower_id
       where s.is_active order by s.copy_started_at desc limit 1`,
    )
  ).rows[0];
  if (!sub) throw new Error("fixture: no active subscription");
  const U = sub.follower_id;
  // clean slate for this customer inside the transaction
  await run("delete from notification_preferences where user_id = $1", [U]);
  await run("delete from notifications where user_id = $1", [U]);
  await run("delete from email_outbox where user_id = $1", [U]);

  const count = async (type) =>
    Number((await run("select count(*) n from notifications where user_id = $1 and type = $2", [U, type])).rows[0].n);
  const send = (type, data) =>
    run("insert into notifications (user_id, type, title, body, data) values ($1, $2, 't', null, $3)", [U, type, JSON.stringify(data)]);

  ok("categories: per-trade is its own category", (await run("select notification_category('copy_opened') a, notification_category('copy_closed') b, notification_category('auto_stop_copy') c, notification_category('loss_alert') d, notification_category('security_new_login') e")).rows[0]
    && JSON.stringify((await run("select notification_category('copy_opened') a, notification_category('copy_closed') b, notification_category('auto_stop_copy') c, notification_category('loss_alert') d, notification_category('security_new_login') e")).rows[0]) === JSON.stringify({ a: "copy_trades", b: "copy_trades", c: "copy", d: "copy", e: "security" }));

  // ---- defaults
  await send("copy_opened", { providerName: "X", symbol: "XAUUSD" });
  await send("copy_closed", { providerName: "X", amount: 5, positive: true });
  ok("default: opened/closed trade notices are not delivered", (await count("copy_opened")) === 0 && (await count("copy_closed")) === 0);
  await send("auto_stop_copy", { maxDrawdownPct: 50 });
  await send("loss_alert", { scope: "copy", providerName: "X", thresholdPct: 10, lossPct: 12 });
  await send("kyc_approved", {});
  await send("security_new_login", {});
  ok("default: auto stop, loss alert, KYC and security are delivered", (await count("auto_stop_copy")) === 1 && (await count("loss_alert")) === 1 && (await count("kyc_approved")) === 1 && (await count("security_new_login")) === 1);

  // ---- opt-in + merging
  await run("insert into notification_preferences (user_id, category, in_app, email) values ($1, 'copy_trades', true, false)", [U]);
  await send("copy_opened", { providerName: "X", symbol: "XAUUSD" });
  await send("copy_opened", { providerName: "X", symbol: "EURUSD" });
  await send("copy_opened", { providerName: "X", symbol: "BTCUSDT" });
  ok("opted in: three opens of one trader are one notice with count 3", (await count("copy_opened")) === 1 &&
    Number((await run("select (data->>'count')::int c from notifications where user_id=$1 and type='copy_opened'", [U])).rows[0].c) === 3);
  await send("copy_opened", { providerName: "Y", symbol: "XAUUSD" });
  ok("a different trader gets its own notice", (await count("copy_opened")) === 2);
  await send("copy_closed", { providerName: "X", amount: 5, positive: true });
  await send("copy_closed", { providerName: "X", amount: 2, positive: false });
  const closed = (await run("select data from notifications where user_id=$1 and type='copy_closed'", [U])).rows;
  ok("closed trades merge with a signed total", closed.length === 1 && Number(closed[0].data.count) === 2 && Math.abs(Number(closed[0].data.amount) - 3) < 0.001 && closed[0].data.positive === true, JSON.stringify(closed[0]?.data));
  await run("update notifications set is_read = true where user_id = $1 and type = 'copy_opened'", [U]);
  await send("copy_opened", { providerName: "X", symbol: "XAUUSD" });
  ok("a read notice is not merged into", (await count("copy_opened")) === 3);

  // explicit off still wins
  await run("update notification_preferences set in_app = false where user_id = $1 and category = 'copy_trades'", [U]);
  await send("copy_opened", { providerName: "Z", symbol: "XAUUSD" });
  ok("opted out again: nothing new is delivered", (await count("copy_opened")) === 3);

  // ---- email policy (real account only; demo trading never emails)
  await run("delete from email_outbox where user_id = $1", [U]);
  const mail = async (kind, account) => {
    await run("select public.email_enqueue($1, $2, public.notification_category($2), $3, '{}'::jsonb)", [U, kind, account]);
    return Number((await run("select count(*) n from email_outbox where user_id = $1 and kind = $2", [U, kind])).rows[0].n);
  };
  await run("delete from notification_preferences where user_id = $1", [U]);
  ok("email default: per-trade off, copy stopped on (real)", (await mail("copy_opened", "real")) === 0 && (await mail("auto_stop_copy", "real")) === 1);
  ok("email: demo account never gets trading emails", (await mail("loss_alert", "demo")) === 0);
  await run("insert into notification_preferences (user_id, category, in_app, email) values ($1, 'copy_trades', true, true)", [U]);
  ok("email opted in: per-trade email is queued (real)", (await mail("copy_closed", "real")) === 1);
  ok("email: security always", (await mail("security_new_login", null)) === 1);

  // ---- subscription start / stop
  await run("delete from notification_preferences where user_id = $1", [U]);
  await run("delete from notifications where user_id = $1", [U]);
  await run("update subscriptions set is_active = false where id = $1", [sub.id]);
  ok("stopping a copy creates a copy_stopped notice", (await count("copy_stopped")) === 1);
  await run("update subscriptions set is_active = true where id = $1", [sub.id]);
  ok("starting a copy creates a copy_started notice", (await count("copy_started")) === 1);
  await run("update subscriptions set is_active = false where id = $1", [sub.id]);
  await send("auto_stop_copy", { maxDrawdownPct: 50 });
  ok("the automatic stop replaces the plain stopped notice", (await count("copy_stopped")) === 0 && (await count("auto_stop_copy")) === 1,
    `stopped=${await count("copy_stopped")} auto=${await count("auto_stop_copy")}`);
  await run("update subscriptions set is_active = true where id = $1", [sub.id]);

  // ---- a copied trader stops trading
  await run("delete from notifications where user_id = $1 and type = 'leader_stopped'", [U]);
  await run("update providers set trading_status = 'stopped' where id = $1", [sub.provider_id]);
  ok("copiers are told when their trader stops trading", (await count("leader_stopped")) === 1);

  // ---- new sign-in
  await run("update profiles set last_login_ip = '203.0.113.10' where id = $1", [U]);
  const before = await count("security_new_login");
  await run("update profiles set last_login_ip = '198.51.100.7' where id = $1", [U]);
  ok("a sign-in from a different address creates a security notice", (await count("security_new_login")) === before + 1, `${await count("security_new_login")} vs ${before + 1}`);
  await run("update profiles set last_login_ip = '198.51.100.7' where id = $1", [U]);
  ok("the same address does not", (await count("security_new_login")) === before + 1);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_trigger where tgname in ('trg_notifications_00_aggregate','trg_notify_follower_subscription_change','trg_notify_copiers_leader_stopped','trg_notify_new_sign_in')")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", `triggers present: ${still}`);
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
