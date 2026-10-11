// Dry run of migration 0252 against the database named by SUPABASE_DB_URL: the migration is applied
// inside ONE transaction, the behaviour is checked as anon / authenticated roles, and the transaction is
// ALWAYS rolled back -- nothing is committed.
//
//   node scripts/check-migration-0252.mjs
//
// Needs: a real account, a demo account, an admin, a simulated leader; it picks them itself.
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const sql = readFileSync("supabase/migrations/0252_deposits_switch_and_column_privileges.sql", "utf8")
  .replace(/^begin;$/m, "-- begin")
  .replace(/^commit;$/m, "-- commit");

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });

const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  const run = (q, p) => c.query(q, p);
  const one = async (q) => (await run(q)).rows[0]?.id;

  const REAL = await one("select id from public.profiles where account_type = 'real' and not is_admin order by id limit 1");
  const DEMO = await one("select id from public.profiles where account_type = 'demo' and not is_admin order by id limit 1");
  const ADMIN = await one("select id from public.profiles where is_admin order by id limit 1");
  const OWNER = await one("select user_id id from public.providers where user_id is not null order by id limit 1");
  const SIM = await one("select id from public.providers where is_simulated and trading_status = 'active' and not is_archived and min_copy_amount <= 500 order by id limit 1");
  if (!REAL || !DEMO || !ADMIN || !SIM) throw new Error("fixtures missing (real, demo, admin, simulated leader)");

  const as = async (role, uid, fn) => {
    await run("savepoint s1");
    try {
      await run("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role, aal: "aal2" } : { role })]);
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

  ok("deposits_enabled() is false", (await run("select public.deposits_enabled() v")).rows[0].v === false);
  ok("sim_leaders_open_to_real() is true while deposits are off", (await run("select public.sim_leaders_open_to_real() v")).rows[0].v === true);

  await as("anon", null, async () => {
    const card = (await run("select * from public.provider_cards limit 1")).rows[0];
    ok("anon: provider_cards readable, no is_simulated", !!card && !("is_simulated" in card));
    ok("anon: public signals columns", (await run("select id, symbol, pnl_usd, return_pct, hidden from public.signals limit 1")).rows.length === 1);
    for (const col of ["predetermined_win", "needs_review", "review_reasons", "is_margin_call", "created_by_admin"]) {
      ok(`anon: signals.${col} denied`, (await failsWith(() => run(`select ${col} from public.signals limit 1`))) === "42501");
    }
    ok("anon: signals select * denied", (await failsWith(() => run("select * from public.signals limit 1"))) === "42501");
    ok("anon: homepage_platform_stats works", (await run("select * from public.homepage_platform_stats()")).rows.length === 1);
  });

  await as("authenticated", DEMO, async () => {
    ok("demo: signals visible under RLS", Number((await run("select count(*) n from public.signals")).rows[0].n) > 0);
    ok("demo: signals select * denied", (await failsWith(() => run("select * from public.signals limit 1"))) === "42501");
    for (const col of ["persona", "skill", "rr_ratio", "activity_weight", "user_id", "is_simulated"]) {
      ok(`demo: providers.${col} denied`, (await failsWith(() => run(`select ${col} from public.providers limit 1`))) === "42501");
    }
    ok("demo: providers public columns", (await run("select id, display_name, min_copy_amount, trading_status from public.providers limit 3")).rows.length === 3);
    ok("demo: provider_cards works", Number((await run("select count(*) n from public.provider_cards")).rows[0].n) > 0);
    ok("demo: own positions with embedded signals", (await run("select id, signals(symbol, side) from public.simulated_positions limit 2")).rows !== undefined);
  });

  if (OWNER) {
    await as("authenticated", OWNER, async () => {
      ok("owner: own_provider_id() resolves", (await run("select public.own_provider_id() v")).rows[0].v !== null);
      for (const [name, q] of [
        ["lead_trader_profiles", "select * from public.lead_trader_profiles where provider_id = public.own_provider_id()"],
        ["follower_invites", "select id from public.follower_invites limit 1"],
        ["subscriptions of own provider", "select id from public.subscriptions where provider_id = public.own_provider_id()"],
        ["simulated_positions of own copiers", "select id from public.simulated_positions limit 1"],
        ["profit_share_ledger", "select id from public.profit_share_ledger limit 1"],
      ]) {
        ok(`owner: ${name} readable`, (await failsWith(() => run(q))) === null);
      }
    });
  }

  await as("authenticated", ADMIN, async () => {
    ok("admin: providers listing columns", (await run("select id, display_name, base_followers_count from public.providers limit 2")).rows.length === 2);
    ok("admin: signals visible columns", (await run("select id, symbol, status from public.signals where status = 'open' limit 2")).rows !== undefined);
  });

  // ---- copy rules (inside the transaction)
  await run("update public.profiles set balance = 5000 where id in ($1, $2)", [REAL, DEMO]);
  const tmp = (
    await run(`insert into public.providers (display_name, min_copy_amount, trading_status, is_simulated, is_archived)
               values ('tmp real leader', 100, 'active', false, false) returning id`)
  ).rows[0].id;
  const copy = (uid, provider) => as("authenticated", uid, () => failsWith(() => run("select public.start_or_update_copy($1, 200)", [provider])));

  ok("off: real account copies a simulated leader", (await copy(REAL, SIM)) === null);
  ok("off: real account copies a real leader without KYC", (await copy(REAL, tmp)) === null);
  ok("off: demo account copies a simulated leader", (await copy(DEMO, SIM)) === null);

  await run("insert into public.lead_trader_profiles (provider_id, accepting_followers) values ($1, false)", [tmp]);
  ok("not accepting followers: new copy refused (CM051)", (await copy(DEMO, tmp)) === "CM051");
  await run("delete from public.lead_trader_profiles where provider_id = $1", [tmp]);

  await run("update public.platform_settings set value = 'true'::jsonb where key = 'deposits_enabled'");
  ok("on: sim_leaders_open_to_real() is false", (await run("select public.sim_leaders_open_to_real() v")).rows[0].v === false);
  ok("on: real account refused a simulated leader (CM050)", (await copy(REAL, SIM)) === "CM050");
  ok("on: real account without KYC refused a real leader (CM052)", (await copy(REAL, tmp)) === "CM052");
  ok("on: demo account still copies a simulated leader", (await copy(DEMO, SIM)) === null);
  await run(
    `insert into public.kyc_submissions (user_id, full_name, national_id_number, id_document_path, address_proof_path, status)
     values ($1, 't', 't', 't', 't', 'approved')`,
    [REAL],
  );
  ok("on: real account with approved KYC copies a real leader", (await copy(REAL, tmp)) === null);

  await run("update public.platform_settings set value = 'false'::jsonb where key = 'deposits_enabled'");
  ok("off again: deposit submit refused (CM035)", (await failsWith(() => run("select public.crypto_deposit_submit($1, 'TRC20', repeat('a', 64))", [REAL]))) === "CM035");
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const left = (await c.query("select count(*) n from public.platform_settings where key = 'deposits_enabled'")).rows[0].n;
  ok("rolled back: nothing committed", left === "0", `deposits_enabled rows: ${left}`);
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
