// Dry run of migration 0268 (optional daily summary) inside ONE rolled-back transaction.
//   node scripts/check-migration-0268.mjs [--live]
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.argv.includes("--live");
const sql = readFileSync("supabase/migrations/0268_daily_summary.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const ON = "00000000-0000-4000-8000-0000000002b1"; // switched on, has closed and open copied trades
const OFF = "00000000-0000-4000-8000-0000000002b2"; // never switched on
const QUIET = "00000000-0000-4000-8000-0000000002b3"; // switched on, nothing copied
let failed = 0;
let passed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  ok ? passed++ : failed++;
};
const q = async (s, p = []) => (await c.query(s, p)).rows;

await c.query("begin");
try {
  if (!live) await c.query(sql);
  for (const [id, mail] of [[ON, "digest-on@example.test"], [OFF, "digest-off@example.test"], [QUIET, "digest-quiet@example.test"]]) {
    await c.query("insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,$2,'{\"account_type\":\"demo\"}','authenticated','authenticated')", [id, mail]);
  }
  for (const id of [ON, QUIET]) await c.query("insert into public.notification_preferences (user_id, category, in_app, email) values ($1, 'digest', true, false)", [id]);

  // copied trades for ON and OFF: two closed in the last hours (one up, one down) and one open
  const [prov] = await q("select id from public.providers where not is_archived limit 1");
  const [sig] = await q("select id, entry_price from public.signals where provider_id = $1 limit 1", [prov.id]);
  for (const user of [ON, OFF]) {
    const [sub] = await q("insert into public.subscriptions (follower_id, provider_id, allocated_amount, is_active) values ($1,$2,1000,true) returning id", [user, prov.id]);
    for (const [status, move] of [["closed", 1.01], ["closed", 0.995], ["open", null]]) {
      await c.query(
        `insert into public.simulated_positions (subscription_id, follower_id, signal_id, entry_price, size, status, opened_at, closed_at, exit_price)
         values ($1, $2, $3, $4::numeric, 100, $5::text, now() - interval '3 hours',
                 case when $5::text = 'closed' then now() - interval '1 hour' end,
                 case when $5::text = 'closed' then round($4::numeric * $6::numeric, 8) end)`,
        [sub.id, user, sig.id, sig.entry_price, status, move],
      );
    }
  }
  const expected = (await q("select coalesce(sum(pnl),0)::float s, count(*)::int n from public.simulated_positions where follower_id = $1 and status = 'closed'", [ON]))[0];

  check((await q("select public.notification_category('copy_daily_summary') c"))[0].c === "digest", "category digest");
  const made = (await q("select public.generate_daily_summaries() n"))[0].n;
  check(made === 1, `one summary made (${made}): only for the customer who switched it on and had copied trades`);
  const [n] = await q("select type, account_type, data from public.notifications where user_id = $1 and type = 'copy_daily_summary'", [ON]);
  check(!!n && n.account_type === "demo", "on the account the customer is using");
  check(n && n.data.closed === expected.n && Math.abs(Number(n.data.amount) - Math.abs(expected.s)) < 0.01 && n.data.positive === expected.s >= 0 && n.data.open === 1, `counts and result (${JSON.stringify(n?.data)})`);
  check((await q("select count(*)::int n from public.notifications where user_id = any($1) and type = 'copy_daily_summary'", [[OFF, QUIET]]))[0].n === 0, "nothing for a customer who did not switch it on, nor on a day with no copied trade");
  // switched on for email only: no in-app notice, no email for demo trading
  await c.query("update public.notification_preferences set in_app = false, email = true where user_id = $1 and category = 'digest'", [ON]);
  await c.query("select public.generate_daily_summaries()");
  check((await q("select count(*)::int n from public.notifications where user_id = $1 and type = 'copy_daily_summary'", [ON]))[0].n === 1, "in-app off: no new notice");
  check((await q("select count(*)::int n from public.email_outbox where user_id = $1 and kind = 'copy_daily_summary'", [ON]))[0].n === 0, "no email for demo trading");
  check((await q("select public.email_category_enabled($1, 'digest') e", [OFF]))[0].e === false, "email off by default");
  check((await q("select count(*)::int n from cron.job where jobname = 'daily-copy-summary'"))[0].n === 1, "scheduled daily");
} finally {
  await c.query("rollback");
  await c.end();
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed`);
process.exitCode = failed ? 1 : 0;
