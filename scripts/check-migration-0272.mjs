// Dry run of migration 0272 inside ONE rolled-back transaction (or --live against the applied view):
// provider_cards gains mdd_floating_all at the end, every earlier column keeps its place and value,
// the grants are unchanged, and the rollback restores the previous view exactly.
//   node scripts/check-migration-0272.mjs [--live]
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.argv.includes("--live");
const strip = (f) => readFileSync(f, "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const up = strip("supabase/migrations/0272_provider_cards_floating_drawdown.sql");
const down = strip("supabase/rollback/0272_provider_cards_floating_drawdown.sql");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
let failed = 0;
let passed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  ok ? passed++ : failed++;
};
const cols = async () => (await c.query("select column_name from information_schema.columns where table_name='provider_cards' order by ordinal_position")).rows.map((r) => r.column_name);
const acl = async () => (await c.query("select relacl::text a from pg_class where relname='provider_cards'")).rows[0].a;
await c.query("begin");
try {
  const { rows: before } = await c.query("select provider_id, roi_30d, risk_level, realized_vol_pct from provider_cards order by provider_id limit 200");
  const colsBefore = await cols();
  const aclBefore = await acl();
  if (!live) await c.query(up);
  const colsAfter = await cols();
  // later migrations (0273) append more columns after it, so only its place right after realized_vol_pct is checked
  check(colsAfter[colsAfter.indexOf("realized_vol_pct") + 1] === "mdd_floating_all", "mdd_floating_all comes right after realized_vol_pct");
  check(live || colsAfter.at(-1) === "mdd_floating_all", "mdd_floating_all is the last column of the view as of 0272");
  check(live || colsAfter.slice(0, -1).join() === colsBefore.filter((x) => x !== "mdd_floating_all").join(), "every earlier column keeps its place");
  check((await acl()) === aclBefore || live, "grants are unchanged");
  const { rows: after } = await c.query("select provider_id, roi_30d, risk_level, realized_vol_pct from provider_cards order by provider_id limit 200");
  check(JSON.stringify(before) === JSON.stringify(after), "values of the existing columns are unchanged");
  const { rows: f } = await c.query("select count(*)::int n, count(mdd_floating_all)::int filled from provider_cards");
  check(f[0].n > 0, `${f[0].filled} of ${f[0].n} leaders have a floating drawdown yet (the job fills the rest)`);
  const { rows: bad } = await c.query(
    "select count(*)::int n from provider_cards c join provider_stats s using (provider_id) where c.mdd_floating_all is distinct from s.mdd_floating_all",
  );
  check(bad[0].n === 0, "the column equals provider_stats.mdd_floating_all");
  await c.query("set local role anon");
  const { rows: an } = await c.query("select count(*)::int n from provider_cards");
  await c.query("reset role");
  check(an[0].n > 0, "anon can still read the view");

  if (!live) {
    await c.query(down);
    const colsRb = await cols();
    check(colsRb.join() === colsBefore.join(), "the rollback restores the previous columns");
    check((await acl()) === aclBefore, "the rollback restores the grants exactly");
    const { rows: rb } = await c.query("select provider_id, roi_30d, risk_level, realized_vol_pct from provider_cards order by provider_id limit 200");
    check(JSON.stringify(before) === JSON.stringify(rb), "the rollback restores the values");
  }
} catch (e) {
  check(false, `unexpected error: ${e.message}`);
} finally {
  await c.query("rollback");
  await c.end();
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed (rolled back)`);
process.exit(failed ? 1 : 0);
