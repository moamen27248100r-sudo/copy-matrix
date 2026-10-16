// Superseded by 0269 (the level now also counts the drawdown): run scripts/check-migration-0269.mjs.
// Dry run of migration 0265 inside ONE rolled-back transaction: every leader's risk level becomes
// the one computed from realized volatility, the refresh keeps it that way, and the changes are
// counted (from -> to).   node scripts/check-migration-0265.mjs [--live]
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.argv.includes("--live");
const sql = readFileSync("supabase/migrations/0265_risk_level_realized_vol.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  if (!ok) failed++;
};
const expected = (vol, trades) => {
  if (!trades || vol == null) return null;
  const a = Number(vol);
  return a >= 40 ? "مرتفعة" : a >= 15 ? "متوسطة" : "منخفضة";
};
await c.query("begin");
try {
  const before = new Map((await c.query("select provider_id, risk_level from public.provider_stats")).rows.map((r) => [r.provider_id, r.risk_level]));
  if (!live) await c.query(sql);
  // realized volatility recomputed here independently: daily return on trading days, whole record, x sqrt(252)
  const vols = new Map((await c.query("select provider_id, case when count(*) >= 5 then round((stddev_samp(pnl / start_equity * 100) * sqrt(252))::numeric, 2) end v from public.provider_daily where start_equity > 0 and trades > 0 group by provider_id")).rows.map((r) => [r.provider_id, r.v]));
  const rows = (await c.query("select provider_id, risk_level, realized_vol_pct, trades_all from public.provider_stats")).rows.map((r) => ({ ...r, vol_daily_pct: vols.get(r.provider_id) ?? null }));
  const volOff = rows.filter((r) => String(r.realized_vol_pct) !== String(r.vol_daily_pct));
  check(volOff.length === 0, `stored realized volatility equals the recomputed one (${volOff.length} off)`);
  const wrong = rows.filter((r) => r.risk_level !== expected(r.vol_daily_pct, r.trades_all));
  check(wrong.length === 0, `every stored level comes from the realized volatility (${rows.length} leaders, ${wrong.length} off)`);
  const sqlFn = (await c.query("select public.leader_risk_level(v) l, v from unnest(array[5, 14.99, 15, 39.99, 40, 90]::numeric[]) v")).rows;
  check(sqlFn.every((r) => r.l === expected(r.v, 5)), `thresholds at 15% and 40% (${sqlFn.map((r) => `${r.v}:${r.l}`).join(", ")})`);
  check((await c.query("select public.leader_risk_level(null) l")).rows[0].l === null, "no volatility yet -> no level");
  // the refresh writes the same level
  const one = rows.find((r) => r.trades_all > 0);
  await c.query("update public.provider_stats set risk_level = null where provider_id = $1", [one.provider_id]);
  await c.query("select public.refresh_provider_stats(array[$1]::uuid[])", [one.provider_id]);
  const again = (await c.query("select risk_level, trades_all from public.provider_stats where provider_id = $1", [one.provider_id])).rows[0];
  check(again.risk_level === expected(one.vol_daily_pct, again.trades_all), "refresh_provider_stats stores the same level");
  // provider_cards (what every screen reads) carries it
  const card = (await c.query("select count(*)::int n from public.provider_cards pc join public.provider_stats st using (provider_id) where pc.risk_level is distinct from st.risk_level")).rows[0].n;
  check(card === 0, "provider_cards shows the stored level");
  const moves = {};
  for (const r of rows) {
    const b = before.get(r.provider_id) ?? "—";
    if (b !== (r.risk_level ?? "—")) moves[`${b} -> ${r.risk_level ?? "—"}`] = (moves[`${b} -> ${r.risk_level ?? "—"}`] ?? 0) + 1;
  }
  const changed = Object.values(moves).reduce((a, b) => a + b, 0);
  console.log(`changed ${changed} of ${rows.length}:`, JSON.stringify(moves));
  const dist = {};
  for (const r of rows) dist[r.risk_level ?? "—"] = (dist[r.risk_level ?? "—"] ?? 0) + 1;
  console.log("after:", JSON.stringify(dist));
} finally {
  await c.query("rollback");
  await c.end();
}
console.log(failed ? `${failed} FAILED` : "all passed");
process.exitCode = failed ? 1 : 0;
