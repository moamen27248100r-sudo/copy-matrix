// Rebuilds the simulated leaders' track records from real 1-minute prices
// (candles.mjs) with the causal engine (engine.mjs).
//
//   node scripts/sim/rebuild.mjs --report <dir> --leaders <id,id,...>
//       generate those leaders' histories in memory and write a report;
//       no database writes.
//   node scripts/sim/rebuild.mjs --report <dir> --all --apply --backup <dir> [--batch 25]
//       same for every simulated leader not built yet, then write them. The
//       first --apply run backs up the simulated leaders' current trades,
//       ledger, cash flows and provider rows to <dir> (JSON lines).
//
// Options: --candidates <n> (default 12) runs per leader, the closest to its
// profile is kept (validate.mjs); --force rebuilds leaders already built at
// this version; --limit <n> stops after n leaders; --exclude-assets <SYM,...>
// leaves out leaders trading those symbols (e.g. while a feed is down);
// --max-db-mb <n> guard.
//
// Safe to run again: a leader built at HISTORY_VERSION is skipped
// (sim_history_builds), and a rebuild replaces the leader's trades inside one
// transaction with deterministic ids, so nothing is ever written twice.
// Customer data is never deleted: a trade a customer copied stays in that
// customer's history (hidden from the leader's public record) and an open one
// keeps running under the live engine.
// Requires migration 0246.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, existsSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { loadCandles, MINUTE, DAY } from "./candles.mjs";
import { Market, SPECS, simulateLeader, followerSeries, notionalUsd } from "./engine.mjs";
import { candidatePersona, targetLog } from "./personas.mjs";
import { scoreCandidate } from "./validate.mjs";
import { Rng } from "./rng.mjs";

export const HISTORY_VERSION = 2;
export const FROM_MS = Date.UTC(2021, 11, 1);
const WARMUP_DAYS = 31;

const require = createRequire(import.meta.url);
const { Client } = require("pg");
require("dotenv").config({ path: ".env.local", quiet: true });

// ---------------------------------------------------------------- helpers

// Deterministic trade id (UUID shaped) from leader, version and trade number.
export function signalId(providerId, version, no) {
  const h = createHash("sha1").update(`signal:${providerId}:v${version}:${no}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const usd = (cents) => (cents / 100).toFixed(2);
const price = (sym, x) => (x / 10 ** SPECS[sym].dp).toFixed(SPECS[sym].dp);
const iso = (ms) => new Date(ms).toISOString();
const dayIso = (k) => new Date(k * DAY).toISOString().slice(0, 10);

// One row per UTC day from the first day to the last (money in cents).
export function buildDaily(sim, startMs, endMs) {
  const first = Math.floor(startMs / DAY);
  const last = Math.floor((endMs - 1) / DAY);
  const rows = new Map();
  for (let k = first; k <= last; k++) rows.set(k, { trades: 0, wins: 0, pnl: 0, gp: 0, gl: 0, wrs: 0, lrs: 0, cash: 0, start: 0 });
  for (const t of sim.trades) {
    if (t.stillOpen) continue;
    const r = rows.get(Math.floor(t.exitMs / DAY));
    r.trades++;
    r.pnl += t.pnl;
    const ret = Math.round(t.returnPct * 1e4); // return_pct x 10^4, exact
    if (t.pnl > 0) {
      r.wins++;
      r.gp += t.pnl;
      r.wrs += ret;
    } else {
      r.gl += -t.pnl;
      r.lrs += ret;
    }
  }
  for (const c of sim.cashFlows) rows.get(Math.min(last, Math.floor(c.at / DAY))).cash += c.amount;
  let equity = 0;
  const out = [];
  for (const [k, r] of rows) {
    r.start = equity;
    equity = r.start + r.cash + r.pnl;
    out.push([k, r]);
  }
  return { daily: out, equity };
}

// Best of `candidates` causal runs for one leader.
export function buildLeader(leader, market, { endMs, candidates }) {
  const profile = leader.persona;
  const startMs = Math.max(new Date(leader.created_at).getTime(), FROM_MS + WARMUP_DAYS * DAY);
  let best = null;
  for (let k = 0; k < candidates; k++) {
    const persona = candidatePersona(profile, new Rng(`hist:${leader.id}:v${HISTORY_VERSION}:${k}`));
    const sim = simulateLeader(persona, market, { startMs, endMs, seed: persona.seed });
    const { score, metrics } = scoreCandidate(persona, sim, startMs);
    if (!best || score < best.score) best = { k, persona, sim, score, metrics };
  }
  const { daily, equity } = buildDaily(best.sim, startMs, endMs);
  const followers = followerSeries(best.persona, daily.map(([k, r]) => [k, { start: r.start, cash: r.cash, pnl: r.pnl }]), best.persona.seed + 1);
  return { ...best, startMs, daily, equity, followers };
}

async function bulkInsert(client, table, cols, types, rows, suffix = "") {
  for (let i = 0; i < rows.length; i += 5000) {
    const chunk = rows.slice(i, i + 5000);
    await client.query(
      `insert into public.${table} (${cols.join(", ")}) select * from unnest(${types.map((t, j) => `$${j + 1}::${t}[]`).join(", ")}) ${suffix}`,
      cols.map((_, j) => chunk.map((r) => r[j])),
    );
  }
}

// Writes built leaders in one transaction (see the header for what is kept),
// then refreshes their stats. Inside a caller's transaction (tests) pass
// { savepoint: true }.
export async function writeBatch(client, batch, endMs, { savepoint = false } = {}) {
  const ids = batch.map((b) => b.leader.id);
  const sig = [];
  const plans = [];
  for (const { leader, r } of batch) {
    for (const t of r.sim.trades) {
      const id = signalId(leader.id, HISTORY_VERSION, t.no);
      if (t.stillOpen) {
        sig.push([id, leader.id, t.sym, t.side, price(t.sym, t.entry), price(t.sym, t.sl), price(t.sym, t.tp), null, "open", iso(t.openMs), null,
          (t.lot / 1000).toFixed(3), null, null, null, null, null]);
        plans.push([id, t.holdMin, t.riskPct.toFixed(4), usd(t.equityAtOpen), iso(t.openMs + t.holdMin * MINUTE), iso(endMs), iso(endMs)]);
      } else {
        sig.push([id, leader.id, t.sym, t.side, price(t.sym, t.entry), price(t.sym, t.sl), price(t.sym, t.tp), price(t.sym, t.exit), "closed",
          iso(t.openMs), iso(t.exitMs), (t.lot / 1000).toFixed(3), t.trigger, usd(t.commission), usd(t.swap), usd(t.pnl), t.returnPct.toFixed(4)]);
      }
    }
  }
  const cash = batch.flatMap(({ leader, r }) => r.sim.cashFlows.map((c) => [leader.id, iso(Math.min(c.at, endMs)), usd(c.amount), c.kind]));
  const daily = batch.flatMap(({ leader, r }) =>
    r.daily.map(([k, d], j) => [leader.id, dayIso(k), d.trades, d.wins, usd(d.pnl), usd(d.gp), usd(d.gl), (d.wrs / 1e4).toFixed(4),
      (d.lrs / 1e4).toFixed(4), usd(d.cash), usd(d.start), r.followers[j].followers, r.followers[j].aum]),
  );

  await client.query(savepoint ? "savepoint write_batch" : "begin");
  try {
    await client.query("set local statement_timeout = 0");
    // Customers' copied trades leave the public record but stay theirs
    // (triggers off: the integrity guard would keep `hidden` unchanged).
    await client.query("set local session_replication_role = replica");
    await client.query(
      `update public.signals g set hidden = true where g.provider_id = any($1) and not g.hidden
         and exists (select 1 from public.simulated_positions sp where sp.signal_id = g.id)`,
      [ids],
    );
    // Everything else of these leaders is replaced (cascades to plans).
    await client.query("set local session_replication_role = origin");
    await client.query(
      `delete from public.signals g where g.provider_id = any($1)
         and not exists (select 1 from public.simulated_positions sp where sp.signal_id = g.id)`,
      [ids],
    );
    await client.query("delete from public.provider_cash_flows where provider_id = any($1)", [ids]);
    await client.query("delete from public.provider_daily where provider_id = any($1)", [ids]);
    // History rows go in without triggers: nothing is copied to today's
    // subscribers, and the ledger below is written directly.
    await client.query("set local session_replication_role = replica");
    await bulkInsert(
      client,
      "signals",
      ["id", "provider_id", "symbol", "side", "entry_price", "stop_loss", "take_profit", "exit_price", "status", "opened_at", "closed_at",
        "lot_size", "close_trigger", "commission", "swap", "pnl_usd", "return_pct"],
      ["uuid", "uuid", "text", "text", "numeric", "numeric", "numeric", "numeric", "text", "timestamptz", "timestamptz", "numeric", "text",
        "numeric", "numeric", "numeric", "numeric"],
      sig,
      "on conflict (id) do nothing",
    );
    await bulkInsert(
      client,
      "sim_trade_plans",
      ["signal_id", "hold_min", "risk_pct", "equity_at_open", "planned_close_at", "next_check_at", "checked_at"],
      ["uuid", "int", "numeric", "numeric", "timestamptz", "timestamptz", "timestamptz"],
      plans,
      "on conflict (signal_id) do nothing",
    );
    await bulkInsert(client, "provider_cash_flows", ["provider_id", "at", "amount", "kind"], ["uuid", "timestamptz", "numeric", "text"], cash);
    await bulkInsert(
      client,
      "provider_daily",
      ["provider_id", "day", "trades", "wins", "pnl", "gross_profit", "gross_loss", "win_ret_sum", "loss_ret_sum", "cash_flow", "start_equity", "followers", "aum"],
      ["uuid", "date", "int", "int", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "int", "numeric"],
      daily,
    );
    // Close reasons normalised exactly like signals_integrity_guard does.
    await client.query(
      `update public.signals g
         set close_trigger = public.trade_close_trigger(g.side, g.entry_price, g.exit_price, g.stop_loss, g.take_profit, g.close_trigger)
       where g.provider_id = any($1) and g.status = 'closed' and not g.hidden
         and g.close_trigger is distinct from public.trade_close_trigger(g.side, g.entry_price, g.exit_price, g.stop_loss, g.take_profit, g.close_trigger)`,
      [ids],
    );
    for (const { leader, r } of batch) {
      const closed = r.sim.trades.filter((t) => !t.stillOpen);
      const bias = Object.entries(r.persona.assets).sort((a, b) => b[1] - a[1]).map(([s]) => s);
      await client.query(
        `update public.providers set persona = $2, account_capital = $3, total_profit = $4, total_withdrawals = $5,
           base_followers_count = $6, total_volume = $7, symbol_bias = $8, rr_ratio = $9 where id = $1`,
        [
          leader.id,
          r.persona,
          usd(r.equity),
          usd(closed.reduce((a, t) => a + t.pnl, 0)),
          usd(-r.sim.cashFlows.filter((c) => c.amount < 0).reduce((a, c) => a + c.amount, 0)),
          (r.followers[r.followers.length - 1] ?? { followers: 0 }).followers,
          r.sim.trades.reduce((a, t) => a + notionalUsd(t.sym, t.lot, t.entry), 0).toFixed(2),
          bias,
          r.persona.rr,
        ],
      );
      await client.query(
        `insert into public.sim_history_builds (provider_id, version, candidate, score, trades, open_trades, history_from, history_to, built_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, now())
         on conflict (provider_id) do update set version = excluded.version, candidate = excluded.candidate, score = excluded.score,
           trades = excluded.trades, open_trades = excluded.open_trades, history_from = excluded.history_from,
           history_to = excluded.history_to, built_at = excluded.built_at`,
        [leader.id, HISTORY_VERSION, r.k, r.score.toFixed(4), r.metrics.trades, r.metrics.open, iso(r.startMs), iso(endMs)],
      );
    }
    await client.query("set local session_replication_role = origin");
    await client.query(savepoint ? "release savepoint write_batch" : "commit");
  } catch (err) {
    await client.query(savepoint ? "rollback to savepoint write_batch" : "rollback").catch(() => {});
    throw err;
  }
  // Stats from the new trades (outside the write transaction).
  await client.query("select public.refresh_provider_stats($1::uuid[], true)", [ids]);
}

// ---------------------------------------------------------------- main

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : def;
  };
  const APPLY = args.includes("--apply");
  const FORCE = args.includes("--force");
  const ALL = args.includes("--all");
  const CANDIDATES = Number(opt("candidates", 12));
  const BATCH = Number(opt("batch", 25));
  const LIMIT = Number(opt("limit", Infinity));
  const MAX_DB_MB = Number(opt("max-db-mb", 2500));
  const REPORT = opt("report", null);
  const BACKUP = opt("backup", null);
  if (APPLY && !BACKUP) throw new Error("--apply needs --backup <dir>");
  const only = (opt("leaders", "") || "").split(",").filter(Boolean);
  const excluded = (opt("exclude-assets", "") || "").split(",").filter(Boolean);
  if (!REPORT) throw new Error("--report <dir> is required");
  if (!ALL && !only.length) throw new Error("--all or --leaders <ids> is required");
  mkdirSync(REPORT, { recursive: true });

  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
  const endMs = Math.floor(Date.now() / MINUTE) * MINUTE - 2 * MINUTE;

  const connect = async () => {
    const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, keepAlive: true });
    c.on("error", (err) => log("connection error:", err.message));
    await c.connect();
    return c;
  };
  let client = await connect();
  const q = async (sql, params) => (await client.query(sql, params)).rows;

  const leaders = await q(
    `select p.id, p.display_name, p.created_at, p.persona, b.version as built
     from public.providers p left join public.sim_history_builds b on b.provider_id = p.id
     where p.is_simulated and p.user_id is null and p.persona is not null
       and (cardinality($1::uuid[]) = 0 or p.id = any($1::uuid[]))
     order by p.id`,
    [only],
  );
  const todo = leaders
    .filter((l) => FORCE || l.built !== HISTORY_VERSION)
    .filter((l) => !Object.keys(l.persona.assets).some((s) => excluded.includes(s)))
    .slice(0, LIMIT);
  log(`leaders ${leaders.length}, to build ${todo.length}, end ${iso(endMs)}`);
  if (!todo.length) return client.end();

  // One backup of what the rebuild replaces, before the first write.
  if (APPLY && !existsSync(join(BACKUP, "done"))) {
    mkdirSync(BACKUP, { recursive: true });
    const tables = [
      ["providers", "p.is_simulated", "public.providers p", "p.id"],
      ["signals", "p.is_simulated", "public.signals t join public.providers p on p.id = t.provider_id", "t.id"],
      ["provider_daily", "p.is_simulated", "public.provider_daily t join public.providers p on p.id = t.provider_id", "(t.provider_id, t.day)"],
      ["provider_cash_flows", "p.is_simulated", "public.provider_cash_flows t join public.providers p on p.id = t.provider_id", "t.id"],
      ["sim_trade_plans", "p.is_simulated", "public.sim_trade_plans t join public.signals g on g.id = t.signal_id join public.providers p on p.id = g.provider_id", "t.signal_id"],
    ];
    for (const [name, where, from, key] of tables) {
      const out = createWriteStream(join(BACKUP, `${name}.jsonl`));
      const alias = name === "providers" ? "p" : "t";
      let n = 0;
      const keyset = !key.startsWith("(");
      const col = key.split(".")[1];
      let last = null;
      for (let offset = 0; ; offset += 20000) {
        const rows = keyset
          ? await q(`select ${alias}.* from ${from} where ${where} ${last ? `and ${key} > $1` : ""} order by ${key} limit 20000`, last ? [last] : [])
          : await q(`select ${alias}.* from ${from} where ${where} order by ${key} limit 20000 offset ${offset}`);
        for (const r of rows) out.write(JSON.stringify(r) + "\n");
        n += rows.length;
        if (rows.length < 20000) break;
        if (keyset) last = rows[rows.length - 1][col];
      }
      await new Promise((r) => out.end(r));
      log(`backup ${name}: ${n}`);
    }
    writeFileSync(join(BACKUP, "done"), new Date().toISOString());
  }

  const symbols = [...new Set(todo.flatMap((l) => Object.keys(l.persona.assets)))].sort();
  const candles = await loadCandles(FROM_MS, endMs + MINUTE, { log, nowMs: endMs + MINUTE, symbols });
  const market = new Market(candles);
  log("candles loaded");

  const csv = ["id,name,persona,style,risk,strategy,candidate,score,track_days,trades,open,win_rate,total_return,annual,max_dd,target_total"];
  const writeReport = (r, l) =>
    csv.push(
      [l.id, JSON.stringify(l.display_name ?? ""), r.persona.key, r.persona.style, r.persona.risk, r.persona.strat, r.k, r.score.toFixed(3),
        Math.round((endMs - r.startMs) / DAY), r.metrics.trades, r.metrics.open, (r.metrics.winRate * 100).toFixed(1),
        (r.metrics.total * 100).toFixed(1), (r.metrics.annual * 100).toFixed(1), (r.metrics.mdd * 100).toFixed(1),
        ((Math.exp(targetLog(r.persona.traj, (endMs - r.startMs) / DAY)) - 1) * 100).toFixed(1)].join(","),
    );

  async function withRetry(label, fn) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const dropped = /terminated|ECONNRESET|not queryable|Connection/i.test(String(err.message));
        if (!dropped || attempt >= 5) throw err;
        log(`${label}: connection dropped (${err.message}), reconnecting (${attempt})`);
        await client.end().catch(() => {});
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        client = await connect();
      }
    }
  }
  let done = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const batch = slice.map((leader) => ({ leader, r: buildLeader(leader, market, { endMs, candidates: CANDIDATES }) }));
    for (const { leader, r } of batch) writeReport(r, leader);
    if (APPLY) {
      const mb = Number((await withRetry("size", () => q("select pg_database_size(current_database()) / 1048576 as mb")))[0].mb);
      if (mb > MAX_DB_MB) throw new Error(`database at ${mb} MB, over the ${MAX_DB_MB} MB guard; stopping (a rerun resumes)`);
      await withRetry(`batch ${i / BATCH + 1}`, () => writeBatch(client, batch, endMs));
    }
    done += slice.length;
    log(`${APPLY ? "written" : "generated"} ${done}/${todo.length}`);
    writeFileSync(join(REPORT, "leaders.csv"), csv.join("\n"));
  }
  if (APPLY) {
    // The live engine's stop distances start from the volatility the history ended on.
    for (const sym of symbols) {
      const k = Math.floor((market.s[sym].index(endMs) - 1) / 60);
      await client.query("update public.sim_symbols set sigma_h = $2 where symbol = $1", [sym, market.sigma[sym][k]]);
    }
    // Audit rows of trades that no longer exist.
    for (;;) {
      const r = await withRetry("audit", () =>
        client.query(`delete from public.trade_audit_log where id in (
            select a.id from public.trade_audit_log a where a.table_name = 'signals'
              and not exists (select 1 from public.signals g where g.id = a.row_id) limit 20000)`),
      );
      if (r.rowCount === 0) break;
    }
    await client.query("vacuum analyze public.signals").catch((err) => log("vacuum skipped:", err.message));
  }
  log("done");
  await client.end();
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
