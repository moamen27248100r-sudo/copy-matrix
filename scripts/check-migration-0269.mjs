// Dry run of migration 0269 inside ONE rolled-back transaction: the risk level is the higher of the
// volatility level and the drawdown level, for every leader; nobody with a drawdown of 30% or more
// is shown low or medium; the changes are counted (from -> to).
//   node scripts/check-migration-0269.mjs [--live] [--deep]
//   --live: against the applied migration (no apply)   --deep: also recompute the floating-loss
//   drawdown of every leader right now (about 3 minutes) and check the badges against it
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.argv.includes("--live");
const deep = process.argv.includes("--deep");
const sql = readFileSync("supabase/migrations/0269_risk_level_drawdown.sql", "utf8")
  .replace(/^begin;\s*$/m, "-- begin")
  .replace(/^commit;\s*$/m, "-- commit");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
let failed = 0;
let passed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  ok ? passed++ : failed++;
};
const LOW = "منخفضة";
const MED = "متوسطة";
const HIGH = "مرتفعة";
const rank = { [LOW]: 0, [MED]: 1, [HIGH]: 2 };
// the rule, written again here independently of the database function
const volLevel = (v) => (v == null ? null : v >= 40 ? HIGH : v >= 15 ? MED : LOW);
const ddLevel = (d) => (d == null ? null : d >= 30 ? HIGH : d >= 15 ? MED : LOW);
const expected = (vol, dd, trades) => {
  if (!trades) return null;
  const a = volLevel(vol == null ? null : Number(vol));
  const b = ddLevel(dd == null ? null : Number(dd));
  if (a == null) return b;
  if (b == null) return a;
  return rank[a] >= rank[b] ? a : b;
};
const num = (v) => (v == null ? null : Number(v));

await c.query("begin");
try {
  const before = new Map((await c.query("select provider_id, risk_level from public.provider_stats")).rows.map((r) => [r.provider_id, r.risk_level]));
  if (!live) {
    await c.query("set local statement_timeout = 0");
    await c.query(sql);
    // fill the floating-loss drawdown for everyone, as the job does over its first runs
    await c.query("select public.refresh_leader_floating_drawdown(1000)");
  }

  const fn = (await c.query("select v, d, public.leader_risk_level(v, d) l from (values (5::numeric, 5::numeric), (14.99, 14.99), (15, 0), (0, 15), (39.99, 29.99), (40, 0), (0, 30), (10, 45), (50, 10), (null, 20), (20, null), (null, null)) t(v, d)")).rows;
  check(fn.every((r) => r.l === (r.v == null && r.d == null ? null : expected(r.v, r.d, 1))), `thresholds: volatility 15 / 40, drawdown 15 / 30, the higher wins (${fn.map((r) => `${r.v ?? "-"}/${r.d ?? "-"}:${r.l ?? "-"}`).join(", ")})`);

  const rows = (await c.query("select provider_id, risk_level, realized_vol_pct, mdd_all, mdd_floating_all, trades_all from public.provider_stats")).rows;
  const dd = (r) => (r.mdd_all == null && r.mdd_floating_all == null ? null : Math.max(num(r.mdd_all) ?? 0, num(r.mdd_floating_all) ?? 0));
  const wrong = rows.filter((r) => r.risk_level !== expected(r.realized_vol_pct, dd(r), r.trades_all));
  check(wrong.length === 0, `every stored level is the higher of the two (${rows.length} leaders, ${wrong.length} off)`);
  const deepDrop = rows.filter((r) => r.trades_all > 0 && dd(r) >= 30 && r.risk_level !== HIGH);
  check(deepDrop.length === 0, `no leader with a drawdown of 30% or more is low or medium (${rows.filter((r) => dd(r) >= 30).length} leaders at 30%+)`);
  const pending = rows.filter((r) => r.trades_all > 0 && (num(r.mdd_all) ?? 0) < 30 && r.mdd_floating_all == null).length;
  check(live || pending === 0, `the floating-loss drawdown is filled (${pending} still waiting for the job)`);

  // the stats refresh writes the same level
  const one = rows.find((r) => r.trades_all > 0);
  await c.query("update public.provider_stats set risk_level = null where provider_id = $1", [one.provider_id]);
  await c.query("select public.refresh_provider_stats(array[$1]::uuid[])", [one.provider_id]);
  const again = (await c.query("select risk_level, realized_vol_pct, mdd_all, mdd_floating_all, trades_all from public.provider_stats where provider_id = $1", [one.provider_id])).rows[0];
  check(again.risk_level === expected(again.realized_vol_pct, dd(again), again.trades_all), "refresh_provider_stats stores the same level");
  const card = (await c.query("select count(*)::int n from public.provider_cards pc join public.provider_stats st using (provider_id) where pc.risk_level is distinct from st.risk_level")).rows[0].n;
  check(card === 0, "provider_cards shows the stored level");
  check((await c.query("select count(*)::int n from cron.job where jobname = 'refresh-leader-floating-drawdown'")).rows[0].n === 1, "the floating-drawdown job is scheduled");

  if (deep) {
    // the figure the profile shows, computed now for everyone
    const ids = rows.filter((r) => r.trades_all > 0).map((r) => r.provider_id);
    const now = new Map();
    for (let i = 0; i < ids.length; i += 60) {
      for (const r of (await c.query("select provider_id, mdd from public.leader_adjusted_drawdown($1, 0)", [ids.slice(i, i + 60)])).rows) now.set(r.provider_id, num(r.mdd));
    }
    const shown = rows.filter((r) => r.trades_all > 0 && Math.max(num(r.mdd_all) ?? 0, now.get(r.provider_id) ?? 0) >= 30 && r.risk_level !== HIGH);
    check(shown.length === 0, `with the drawdown recomputed now, nobody at 30%+ is low or medium (${shown.length})`);
  }

  if (!live) {
    const moves = {};
    for (const r of rows) {
      const b = before.get(r.provider_id) ?? "—";
      const a = r.risk_level ?? "—";
      if (b !== a) moves[`${b} -> ${a}`] = (moves[`${b} -> ${a}`] ?? 0) + 1;
    }
    console.log(`changed ${Object.values(moves).reduce((x, y) => x + y, 0)} of ${rows.length}:`, JSON.stringify(moves));
  }
  const dist = {};
  for (const r of rows) dist[r.risk_level ?? "—"] = (dist[r.risk_level ?? "—"] ?? 0) + 1;
  console.log("levels:", JSON.stringify(dist));
} finally {
  await c.query("rollback");
  await c.end();
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed`);
process.exitCode = failed ? 1 : 0;
