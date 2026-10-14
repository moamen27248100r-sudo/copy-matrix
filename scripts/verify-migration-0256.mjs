// Read-only verification that migration 0256 is applied.   node scripts/verify-migration-0256.mjs
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const trg = await c.query("select tgname from pg_trigger where not tgisinternal and tgname in ('trg_notifications_00_aggregate','trg_notify_follower_subscription_change','trg_notify_copiers_leader_stopped','trg_notify_new_sign_in')");
  ok("all four triggers exist", trg.rows.length === 4, trg.rows.map((r) => r.tgname).join(","));
  const cat = await c.query("select notification_category('copy_opened') a, notification_category('copy_started') b, notification_category('security_new_login') c");
  ok("categories follow the policy", cat.rows[0].a === "copy_trades" && cat.rows[0].b === "copy" && cat.rows[0].c === "security");
  const con = await c.query("select pg_get_constraintdef(oid) d from pg_constraint where conname = 'notification_preferences_category_check'");
  ok("preferences accept the per-trade category", /copy_trades/.test(con.rows[0]?.d ?? ""));
  const mail = await c.query("select email_category_enabled('00000000-0000-0000-0000-000000000000'::uuid, 'copy_trades') a, email_category_enabled('00000000-0000-0000-0000-000000000000'::uuid, 'copy') b");
  ok("email defaults: per-trade off, copy on", mail.rows[0].a === false && mail.rows[0].b === true);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
