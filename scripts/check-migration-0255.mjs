// Dry run of migration 0255 against the database named by SUPABASE_DB_URL: the migration is applied
// inside ONE transaction, behaviour is checked as real customers / the service role, and the
// transaction is ALWAYS rolled back -- nothing is committed.
//
//   node scripts/check-migration-0255.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const sql = readFileSync("supabase/migrations/0255_benchmark_cache_portfolio_summary_loss_alerts.sql", "utf8")
  .replace(/^begin;\s*$/m, "-- begin")
  .replace(/^commit;\s*$/m, "-- commit");

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const near = (a, b, eps = 0.011) => Math.abs(Number(a) - Number(b)) <= eps;

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  const run = (q, p) => c.query(q, p);
  const claims = (role, uid) => JSON.stringify(uid ? { sub: uid, role, aal: "aal2" } : { role });
  const as = async (role, uid, fn, keep = false) => {
    if (!keep) await run("savepoint s1");
    try {
      await run("select set_config('request.jwt.claims', $1, true)", [claims(role, uid)]);
      await run(`set local role ${role}`);
      return await fn();
    } finally {
      await run("reset role");
      if (!keep) await run("rollback to savepoint s1");
    }
  };
  const failsWith = async (fn) => {
    await run("savepoint e1");
    try {
      await fn();
      await run("release savepoint e1");
      return null;
    } catch (e) {
      await run("rollback to savepoint e1");
      return e.code || e.message;
    }
  };

  await run(sql);

  // ---- benchmark cache
  const bundle = await as("authenticated", (await run("select id from profiles limit 1")).rows[0].id, async () =>
    (await run("select public.benchmark_bundle() b")).rows[0].b,
  );
  const symbolsOk = ["BTCUSDT", "XAUUSD"].every((s) => bundle[s] && ["1", "7", "30", "90", "365", "0"].every((d) => Array.isArray(bundle[s][d])));
  ok("benchmark_bundle has both symbols and all six periods", symbolsOk, Object.keys(bundle).join(","));
  const lens = Object.values(bundle.BTCUSDT).map((p) => p.length);
  ok("every series is short (<= 62 points) and the 7-day one is not empty", lens.every((n) => n <= 62) && bundle.BTCUSDT["7"].length > 5, lens.join(","));
  ok("series are ordered by time", Object.values(bundle.BTCUSDT).every((p) => p.every((x, i, a) => i === 0 || a[i - 1].t <= x.t)));
  ok(
    "anon cannot read the bundle",
    (await as("anon", null, () => failsWith(() => run("select public.benchmark_bundle()")))) === "42501",
  );
  ok(
    "authenticated cannot read the cache table directly",
    (await as("authenticated", (await run("select id from profiles limit 1")).rows[0].id, () => failsWith(() => run("select * from benchmark_cache")))) === "42501",
  );

  // ---- dashboard_summary still right + risk_level
  const busiest = (await run("select follower_id id, count(*) n from simulated_positions group by 1 order by 2 desc limit 1")).rows[0];
  const withSubs = (await run("select follower_id id from subscriptions where is_active group by 1 order by count(*) desc limit 1")).rows[0];
  const users = [...new Map([busiest, withSubs].filter(Boolean).map((u) => [u.id, u])).values()];
  for (const u of users) {
    const type = (await run("select account_type t from profiles where id = $1", [u.id])).rows[0].t;
    const exp = (
      await run(
        `select count(*) filter (where status = 'closed') closed_count, coalesce(sum(pnl) filter (where status = 'closed'), 0) realized,
                (select avg(case when sp2.exit_price is null or sp2.entry_price <= 0 then 0
                   else ((sp2.exit_price - sp2.entry_price) / sp2.entry_price) * (case when sg.side = 'sell' then -1 else 1 end) * 100 end)
                 from simulated_positions sp2 join signals sg on sg.id = sp2.signal_id
                 where sp2.follower_id = $1 and sp2.account_type = $2 and sp2.status = 'closed') avg_ret
         from simulated_positions where follower_id = $1 and account_type = $2`,
        [u.id, type],
      )
    ).rows[0];
    const label = `user ${String(u.id).slice(0, 8)}`;
    const t0 = Date.now();
    const doc = await as("authenticated", u.id, async () => (await run("select public.portfolio_summary('Africa/Cairo') d")).rows[0].d);
    const ms = Date.now() - t0;
    ok(`${label}: portfolio_summary in ${ms}ms`, ms < 3000 && doc && typeof doc === "object");
    ok(`${label}: closed count + realized match`, Number(doc.closed.closed_count) === Number(exp.closed_count) && near(doc.closed.realized, exp.realized));
    ok(`${label}: average return matches`, (exp.avg_ret == null && doc.avg_return_pct == null) || near(doc.avg_return_pct, exp.avg_ret, 0.0101));
    ok(`${label}: monthly has <= 6 rows, newest first`, doc.monthly.length <= 6 && doc.monthly.every((m, i, a) => i === 0 || a[i - 1].key >= m.key));
    ok(`${label}: monthly trades add up (within the six months)`, doc.monthly.reduce((s, m) => s + Number(m.trades), 0) <= Number(exp.closed_count));
    ok(`${label}: every copied trader row carries risk_level`, doc.by_provider.every((p) => "risk_level" in p));
  }
  ok(
    "anon cannot call portfolio_summary",
    (await as("anon", null, () => failsWith(() => run("select public.portfolio_summary('UTC')")))) === "42501",
  );

  // ---- loss alerts
  ok(
    "loss_alert is in the copy category and follows the account type",
    (await run("select public.notification_category('loss_alert') c")).rows[0].c === "copy",
  );
  const sub = (
    await run(
      `select s.id, s.follower_id, s.provider_id, s.allocated_amount, p.account_type
       from subscriptions s join profiles p on p.id = s.follower_id
       where s.is_active and s.allocated_amount > 0 order by s.allocated_amount desc limit 1`,
    )
  ).rows[0];
  const sig = (await run("select id from signals where side = 'buy' order by id limit 1")).rows[0];
  if (!sub) throw new Error("fixture: no active subscription");
  const uid = sub.follower_id;
  const countAlerts = async () => Number((await run("select count(*) n from notifications where user_id = $1 and type = 'loss_alert'", [uid])).rows[0].n);

  await as("authenticated", uid, async () => {
    ok("invalid threshold refused (22023)", (await failsWith(() => run("select public.set_loss_alert($1, 95)", [sub.provider_id]))) === "22023");
    ok("copy that is not active refused (22023)", (await failsWith(() => run("select public.set_loss_alert('00000000-0000-0000-0000-000000000001', 10)"))) === "22023");
    ok("direct insert into loss_alert_rules refused (42501)", (await failsWith(() => run("insert into loss_alert_rules (user_id, threshold_pct) values ($1, 10)", [uid]))) === "42501");
  });
  ok(
    "anon cannot set an alert",
    (await as("anon", null, () => failsWith(() => run("select public.set_loss_alert(null, 10)")))) === "42501",
  );

  await as("authenticated", uid, () => run("select public.set_loss_alert($1, 10)", [sub.provider_id]), true);
  await as("authenticated", uid, () => run("select public.set_loss_alert(null, 5)"), true);
  const rules = (await run("select count(*) n from loss_alert_rules where user_id = $1", [uid])).rows[0].n;
  ok("two rules stored (copy + portfolio)", Number(rules) === 2, rules);
  const seen = await as("authenticated", uid, async () => Number((await run("select count(*) n from loss_alert_rules")).rows[0].n), true);
  ok("the customer sees only their own rules", seen === 2, seen);

  // no loss yet: nothing is sent
  const before = await countAlerts();
  await as("service_role", null, () => run("select public.evaluate_loss_alerts()"), true);
  ok("no loss yet: no copy alert", (await countAlerts()) === before);

  // a closed losing trade of 20% of the allocation
  const lossAmount = Number(sub.allocated_amount) * 0.2;
  const ins = await run(
    `insert into simulated_positions (signal_id, subscription_id, follower_id, entry_price, exit_price, size, status, pnl, opened_at, closed_at, account_type)
     values ($1, $2, $3, 100, 80, $4, 'closed', $5, now() - interval '2 hours', now() - interval '1 hour', $6) returning id`,
    [sig.id, sub.id, uid, lossAmount * 5, -lossAmount, sub.account_type],
  );
  const posId = ins.rows[0].id;
  await as("service_role", null, () => run("select public.evaluate_loss_alerts()"), true);
  const n1 = await countAlerts();
  const copyAlerts = Number((await run("select count(*) n from notifications where user_id = $1 and type = 'loss_alert' and data->>'scope' = 'copy'", [uid])).rows[0].n);
  ok("breach: exactly one alert for the copy (portfolio alert may fire too)", copyAlerts === 1 && n1 - before >= 1, `copy ${copyAlerts}, new ${n1 - before}`);
  const firstWave = n1 - before;
  const row = (await run("select data, account_type from notifications where user_id = $1 and type = 'loss_alert' order by created_at desc limit 1", [uid])).rows[0];
  ok("alert carries scope, trader, threshold and loss", row?.data && ["scope", "providerName", "thresholdPct", "lossPct"].every((k) => k in row.data), JSON.stringify(row?.data));
  ok("alert belongs to the customer's account", row?.account_type === sub.account_type);
  await as("service_role", null, () => run("select public.evaluate_loss_alerts()"), true);
  ok("still breached: no repeat", (await countAlerts()) === n1, `${await countAlerts()} vs ${n1}`);

  // recovers below the threshold, then breaches again: a second alert
  await run("update simulated_positions set exit_price = 100, pnl = 0 where id = $1", [posId]);
  await as("service_role", null, () => run("select public.evaluate_loss_alerts()"), true);
  const rearmed = (await run("select breached from loss_alert_rules where user_id = $1 and provider_id = $2", [uid, sub.provider_id])).rows[0].breached;
  ok("loss back under the threshold re-arms the rule", rearmed === false);
  await run("update simulated_positions set exit_price = 80, pnl = $2 where id = $1", [posId, -lossAmount]);
  await as("service_role", null, () => run("select public.evaluate_loss_alerts()"), true);
  ok("crossing again sends one more alert per rule", (await countAlerts()) === n1 + firstWave, `${await countAlerts()} vs ${n1 + firstWave}`);

  // removing an alert
  await as("authenticated", uid, () => run("select public.set_loss_alert($1, 0)", [sub.provider_id]), true);
  const left = (await run("select count(*) n from loss_alert_rules where user_id = $1 and provider_id is not null", [uid])).rows[0].n;
  ok("threshold 0 removes the rule", Number(left) === 0);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_proc where proname in ('benchmark_bundle','portfolio_summary','set_loss_alert','evaluate_loss_alerts','refresh_benchmark_cache')")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", `functions present: ${still}`);
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
