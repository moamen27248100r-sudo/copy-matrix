// Dry run of migration 0264 inside ONE rolled-back transaction: the bulk sparklines equal the
// per-trader series the cards used before.   node scripts/check-migration-0264.mjs [--live]
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const live = process.argv.includes("--live");
const sql = readFileSync("supabase/migrations/0264_provider_sparklines.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  if (!live) await c.query(sql);
  const ids = (await c.query("select provider_id from provider_cards where not is_archived order by rating_score desc nulls last limit 5")).rows.map((r) => r.provider_id);
  const bulk = new Map((await c.query("select provider_id, series from provider_sparklines($1::uuid[], 30)", [ids])).rows.map((r) => [r.provider_id, r.series.map(Number)]));
  ok("one series per trader", bulk.size === ids.length, `${bulk.size}/${ids.length}`);
  for (const id of ids) {
    const one = (await c.query("select provider_daily_series($1) s", [id])).rows[0].s;
    let index = 1;
    const expect = [0];
    for (const r of one.ret.slice(-30)) {
      index *= 1 + Number(r);
      expect.push((index - 1) * 100);
    }
    const got = bulk.get(id) ?? [];
    const same = got.length === expect.length && got.every((v, i) => Math.abs(v - expect[i]) < 0.01);
    ok(`trader ${id.slice(0, 8)}: same curve as before (${expect.length} points)`, same, `${got.length} vs ${expect.length}`);
  }
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  await c.end();
}
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
}
console.log(failed ? `${failed} FAILED` : `all ${results.length} passed (rolled back)`);
process.exit(failed ? 1 : 0);
