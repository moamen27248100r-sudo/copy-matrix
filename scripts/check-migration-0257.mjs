// Dry run of migration 0257 inside ONE rolled-back transaction.   node scripts/check-migration-0257.mjs
// Cross-checks the SQL function against the reference implementation in src/lib/leader-scores.ts.
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
import { maxDrawdownWithFloating } from "../src/lib/leader-scores.ts";

config({ path: ".env.local", quiet: true });
const sql = readFileSync("supabase/migrations/0257_leader_trade_extremes.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  await c.query(sql);
  const ids = (await c.query("select provider_id from provider_cards where trades_all >= 40 order by trades_all desc limit 12")).rows.map((r) => r.provider_id);

  for (const days of [7, 30, 0]) {
    const t0 = Date.now();
    const res = (await c.query("select * from public.leader_adjusted_drawdown($1::uuid[], $2)", [ids, days])).rows;
    const ms = Date.now() - t0;
    ok(`12 leaders, period ${days || "all"}: answered in ${ms}ms`, ms < 8000, ms);
    ok(`period ${days || "all"}: one row per leader`, res.length === ids.length);
    ok(`period ${days || "all"}: values are sane (0..100)`, res.every((r) => r.mdd != null && Number(r.mdd) >= 0 && Number(r.mdd) <= 100));
  }

  // reference check on 4 leaders, last 30 days
  const sample = ids.slice(0, 4);
  const sqlRows = (await c.query("select * from public.leader_adjusted_drawdown($1::uuid[], 30)", [sample])).rows;
  for (const pid of sample) {
    const trades = (
      await c.query(
        `select (extract(epoch from t.opened_at)*1000)::float8 o,
                case when t.closed_at is null then null else (extract(epoch from t.closed_at)*1000)::float8 end c,
                t.pnl_usd::float8 pnl, w.fl::float8 worst, (extract(epoch from w.ts)*1000)::float8 wt
         from signals t
         left join sim_symbols ss on ss.symbol = t.symbol
         left join lateral (
           select ph.ts, ((ph.price - t.entry_price) * (case when t.side='sell' then -1 else 1 end) / nullif(ss.pip,0)) * ss.val * coalesce(t.lot_size,0) as fl
           from price_history ph where ph.symbol = t.symbol and ph.ts >= t.opened_at and ph.ts <= coalesce(t.closed_at, now())
           order by fl asc limit 1) w on true
         where t.provider_id = $1 and not t.hidden and not t.created_by_admin and (t.closed_at is null or t.closed_at >= now() - interval '30 days')`,
        [pid],
      )
    ).rows;
    const start = Number(
      (
        await c.query(
          `select start_equity + cash_flow e from provider_daily where provider_id = $1 and day >= (now() - interval '30 days')::date order by day limit 1`,
          [pid],
        )
      ).rows[0]?.e ?? 0,
    );
    const ref = maxDrawdownWithFloating(trades, start, Date.now());
    const got = Number(sqlRows.find((r) => r.provider_id === pid)?.mdd);
    ok(`reference matches SQL for ${String(pid).slice(0, 8)} (${got}% vs ${ref}%)`, ref != null && Math.abs(ref - got) < 0.06, `${got} vs ${ref}`);
  }

  await c.query("set local role anon");
  const anon = await c.query("select count(*) n from public.leader_adjusted_drawdown($1::uuid[], 7)", [ids.slice(0, 2)]);
  ok("a visitor can read it (leaders are public)", Number(anon.rows[0].n) === 2);
  await c.query("reset role");
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_proc where proname = 'leader_adjusted_drawdown'")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", still);
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
