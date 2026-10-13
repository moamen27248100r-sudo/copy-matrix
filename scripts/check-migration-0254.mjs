// Dry run of migration 0254 against the database named by SUPABASE_DB_URL: the migration is applied
// inside ONE transaction, its functions are checked against independent queries as real customers,
// and the transaction is ALWAYS rolled back -- nothing is committed.
//
//   node scripts/check-migration-0254.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const sql = readFileSync("supabase/migrations/0254_dashboard_summary_rpc.sql", "utf8")
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
  const as = async (role, uid, fn) => {
    await run("savepoint s1");
    try {
      await run("select set_config('request.jwt.claims', $1, true)", [claims(role, uid)]);
      await run(`set local role ${role}`);
      return await fn();
    } finally {
      await run("reset role");
      await run("rollback to savepoint s1");
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

  // Customers to compare: the busiest one, one with active copies, and the QA test account.
  const busiest = (await run("select follower_id id, count(*) n from simulated_positions group by 1 order by 2 desc limit 1")).rows[0];
  const withSubs = (await run("select follower_id id from subscriptions where is_active group by 1 order by count(*) desc limit 1")).rows[0];
  const qa = (await run("select id from profiles where email = 'mo48100r@gmail.com'")).rows[0];
  const users = [...new Map([busiest, withSubs, qa].filter(Boolean).map((u) => [u.id, u])).values()];
  ok("fixtures: at least one customer with positions", users.length > 0 && Number(busiest?.n ?? 0) > 0, `busiest has ${busiest?.n}`);

  for (const u of users) {
    const type = (await run("select account_type t from profiles where id = $1", [u.id])).rows[0].t;
    const exp = (
      await run(
        `select count(*) filter (where status = 'closed') closed_count,
                count(*) filter (where status = 'closed' and coalesce(pnl,0) > 0) wins,
                coalesce(sum(pnl) filter (where status = 'closed'), 0) realized,
                max(pnl) filter (where status = 'closed') best,
                min(pnl) filter (where status = 'closed') worst,
                count(*) filter (where status = 'open') open_count,
                coalesce(sum(size) filter (where status = 'open'), 0) invested
         from simulated_positions where follower_id = $1 and account_type = $2`,
        [u.id, type],
      )
    ).rows[0];
    const subs = Number((await run("select count(*) n from subscriptions where follower_id = $1 and is_active", [u.id])).rows[0].n);
    const led = (await run("select coalesce(sum(amount),0) s from wallet_transactions where user_id = $1 and account_type = $2 and type in ('pnl','fee')", [u.id, type])).rows[0].s;
    const bal = (await run("select balance b from profiles where id = $1", [u.id])).rows[0].b;

    const label = `user ${String(u.id).slice(0, 8)}`;
    const t0 = Date.now();
    const doc = await as("authenticated", u.id, async () => (await run("select public.dashboard_summary('Africa/Cairo') d")).rows[0].d);
    const ms = Date.now() - t0;
    ok(`${label}: returns a document in ${ms}ms`, doc && typeof doc === "object" && ms < 3000);
    ok(`${label}: closed count`, Number(doc.closed.closed_count) === Number(exp.closed_count), `${doc.closed.closed_count} vs ${exp.closed_count}`);
    ok(`${label}: wins`, Number(doc.closed.wins) === Number(exp.wins));
    ok(`${label}: realized`, near(doc.closed.realized, exp.realized));
    ok(`${label}: best / worst`, (exp.best == null && doc.closed.best == null) || (near(doc.closed.best, exp.best) && near(doc.closed.worst, exp.worst)));
    ok(`${label}: open count + invested`, Number(doc.open.count) === Number(exp.open_count) && near(doc.open.invested, exp.invested));
    ok(`${label}: one row per active copy`, doc.by_provider.length === subs, `${doc.by_provider.length} vs ${subs}`);
    ok(`${label}: net invested = balance - ledger P&L`, near(doc.net_invested, Number(bal) - Number(led)));
    ok(`${label}: series is ordered`, doc.series.every((p, i, a) => i === 0 || a[i - 1].t <= p.t));
    ok(`${label}: by_provider sorted high to low`, doc.by_provider.every((p, i, a) => i === 0 || Number(a[i - 1].total) >= Number(p.total)));
  }

  // access rules
  ok(
    "anon cannot call dashboard_summary",
    (await as("anon", null, () => failsWith(() => run("select public.dashboard_summary('UTC')")))) === "42501",
  );
  ok(
    "authenticated without a user id is refused (28000)",
    (await as("authenticated", null, () => failsWith(() => run("select public.dashboard_summary('UTC')")))) === "28000",
  );
  const u0 = users[0];
  await as("authenticated", u0.id, async () => {
    ok("unknown timezone falls back to UTC", (await failsWith(() => run("select public.dashboard_summary('Not/AZone')"))) === null);
    ok("empty timezone is accepted", (await failsWith(() => run("select public.dashboard_summary('')"))) === null);
    const btc = (await run("select public.benchmark_series('BTCUSDT', 30) d")).rows[0].d;
    ok("benchmark_series BTCUSDT returns a short ordered line", Array.isArray(btc) && btc.length > 5 && btc.length <= 100 && btc.every((p, i, a) => i === 0 || a[i - 1].t <= p.t), `len ${btc.length}`);
    const gold = (await run("select public.benchmark_series('XAUUSD', 0) d")).rows[0].d;
    ok("benchmark_series XAUUSD (all time) works", Array.isArray(gold) && gold.length > 5 && gold.length <= 100, `len ${gold.length}`);
    ok("benchmark_series refuses other symbols (22023)", (await failsWith(() => run("select public.benchmark_series('ETHUSDT', 30)"))) === "22023");
  });
  ok(
    "anon cannot call benchmark_series",
    (await as("anon", null, () => failsWith(() => run("select public.benchmark_series('BTCUSDT', 30)")))) === "42501",
  );
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_proc where proname in ('dashboard_summary','benchmark_series')")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", `functions present: ${still}`);
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
