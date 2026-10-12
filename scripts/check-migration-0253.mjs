// Dry run of migration 0253 against the database named by SUPABASE_DB_URL: the migration is applied
// inside ONE transaction, behaviour is checked as anon / authenticated / service_role, and the
// transaction is ALWAYS rolled back -- nothing is committed.
//
//   node scripts/check-migration-0253.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const sql = readFileSync("supabase/migrations/0253_lock_write_grants_and_fix_positions_policy.sql", "utf8")
  .replace(/^begin;\s*$/m, "-- begin")
  .replace(/^commit;\s*$/m, "-- commit");

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  const run = (q, p) => c.query(q, p);
  const one = async (q) => (await run(q)).rows[0]?.id;
  const DEMO = await one("select id from public.profiles where account_type = 'demo' and not is_admin order by id limit 1");
  const ADMIN = await one("select id from public.profiles where is_admin order by id limit 1");
  const SIM = await one(
    "select id from public.providers where is_simulated and trading_status = 'active' and not is_archived and min_copy_amount <= 500 order by id limit 1",
  );
  const SIG = await one("select id from public.signals order by id limit 1");
  if (!DEMO || !ADMIN || !SIM || !SIG) throw new Error("fixtures missing (demo, admin, simulated leader, signal)");

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
  // returns the SQLSTATE of a failure, or null when the statement succeeded
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

  const T = {
    signals: {
      ins: "insert into public.signals (provider_id, symbol, side, entry_price) values ($1, 'BTCUSDT', 'buy', 82500)",
      args: [SIM],
      upd: "update public.signals set hidden = hidden where id = $1",
      uargs: [SIG],
      del: "delete from public.signals where id = $1",
      dargs: [SIG],
    },
    providers: {
      ins: "insert into public.providers (display_name) values ('x')",
      args: [],
      upd: "update public.providers set bio = bio where id = $1",
      uargs: [SIM],
      del: "delete from public.providers where id = $1",
      dargs: [SIM],
    },
    simulated_positions: {
      ins: "insert into public.simulated_positions (signal_id, follower_id, entry_price) values ($1, $2, 1)",
      args: [SIG, DEMO],
      upd: "update public.simulated_positions set size = size where follower_id = $1",
      uargs: [DEMO],
      del: "delete from public.simulated_positions where follower_id = $1",
      dargs: [DEMO],
    },
  };

  // before: the recursion error the migration removes
  await as("authenticated", DEMO, async () => {
    const e = await failsWith(() => run(T.simulated_positions.ins, T.simulated_positions.args));
    ok("before: customer insert on simulated_positions fails with recursion (42P17)", e === "42P17", `code ${e}`);
  });

  await run(sql);

  for (const [uid, label] of [[DEMO, "customer"], [ADMIN, "admin session"]]) {
    await as("authenticated", uid, async () => {
      for (const [t, q] of Object.entries(T)) {
        ok(`${label}: INSERT ${t} -> 42501`, (await failsWith(() => run(q.ins, q.args))) === "42501");
        ok(`${label}: UPDATE ${t} -> 42501`, (await failsWith(() => run(q.upd, q.uargs))) === "42501");
        ok(`${label}: DELETE ${t} -> 42501`, (await failsWith(() => run(q.del, q.dargs))) === "42501");
      }
    });
  }
  await as("anon", null, async () => {
    for (const [t, q] of Object.entries(T)) {
      ok(`anon: INSERT ${t} refused`, (await failsWith(() => run(q.ins, q.args))) === "42501");
    }
  });

  // reads the app relies on are untouched
  await as("authenticated", DEMO, async () => {
    ok("customer: signals readable", (await failsWith(() => run("select id from public.signals limit 3"))) === null);
    ok("customer: provider_cards readable", (await failsWith(() => run("select * from public.provider_cards limit 3"))) === null);
    ok("customer: own positions readable", (await failsWith(() => run("select id, status, pnl from public.simulated_positions limit 3"))) === null);
  });
  await as("authenticated", ADMIN, async () => {
    ok("admin: simulated_positions readable", (await failsWith(() => run("select id from public.simulated_positions limit 3"))) === null);
  });

  // the service role (admin panel actions) keeps full write access
  await as("service_role", null, async () => {
    { const e = await failsWith(() => run(T.signals.ins, T.signals.args)); ok("service_role: INSERT signals", e === null, e); }
    ok("service_role: UPDATE providers", (await failsWith(() => run(T.providers.upd, T.providers.uargs))) === null);
    ok("service_role: UPDATE simulated_positions", (await failsWith(() => run(T.simulated_positions.upd, T.simulated_positions.uargs))) === null);
  });

  // the copy pipeline (security-definer paths) still works end to end
  await run("savepoint pipe");
  try {
    await run("delete from public.subscriptions where follower_id = $1", [DEMO]);
    await run("update public.profiles set balance = greatest(balance, 5000) where id = $1", [DEMO]);
    await run("select set_config('request.jwt.claims', $1, true)", [claims("authenticated", DEMO)]);
    await run("set local role authenticated");
    const e1 = await failsWith(() => run("select public.start_or_update_copy($1, 500)", [SIM]));
    await run("reset role");
    ok("pipeline: customer start_or_update_copy works", e1 === null, e1);
    const e2 = await failsWith(() =>
      run("insert into public.signals (provider_id, symbol, side, entry_price) values ($1, 'BTCUSDT', 'buy', 82500)", [SIM]),
    );
    ok("pipeline: leader signal insert (service path) works", e2 === null, e2);
    const pos = (await run("select count(*) n from public.simulated_positions where follower_id = $1", [DEMO])).rows[0].n;
    ok("pipeline: signal mirrored into copier's position by trigger", Number(pos) > 0, `positions ${pos}`);
    // rows created in this transaction share now(); age them so closed_at > opened_at holds
    await run("update public.signals set opened_at = now() - interval '1 hour' where provider_id = $1 and status = 'open'", [SIM]);
    await run("update public.simulated_positions set opened_at = now() - interval '1 hour' where follower_id = $1", [DEMO]);
    await run("select set_config('request.jwt.claims', $1, true)", [claims("authenticated", DEMO)]);
    await run("set local role authenticated");
    const pid = (await run("select id from public.simulated_positions where follower_id = $1 and status = 'open' limit 1", [DEMO])).rows[0]?.id;
    const e3 = pid ? await failsWith(() => run("select public.close_my_position($1)", [pid])) : "no open position";
    await run("reset role");
    ok("pipeline: customer close_my_position works", e3 === null, e3);
  } finally {
    await run("reset role");
    await run("rollback to savepoint pipe");
  }
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_proc where proname = 'signal_created_by_admin'")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", `helper functions present: ${still}`);
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
