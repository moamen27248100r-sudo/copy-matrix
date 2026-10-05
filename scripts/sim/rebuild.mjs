// Rebuilds the simulated leaders around the 13 personas.
//
//   node scripts/sim/rebuild.mjs --plan --report <dir>
//       pick the leaders to keep, assign personas, generate and validate
//       every history in memory, write a CSV report; no database writes.
//   node scripts/sim/rebuild.mjs --apply --report <dir> --backup <dir>
//       same, then back up the affected tables to <dir> and replace the
//       simulated leaders' data in one transaction.
//
// Options: --keep <n> (default 750), --version <n> (seed version, default 1).
// Requires migrations 0234 / 0235. Candle downloads are cached (candles.mjs).

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, createWriteStream, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ensureCandles, HourlySeries, HOUR } from "./candles.mjs";
import { PriceBook, simulateLeader, followerSeries, notionalUsd } from "./engine.mjs";
import { PERSONAS, PERSONA_KEYS, drawPersona } from "./personas.mjs";
import { validateLeader } from "./validate.mjs";
import { Rng } from "./rng.mjs";

const require = createRequire(import.meta.url);
const { Client } = require("pg");
require("dotenv").config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const APPLY = args.includes("--apply");
const KEEP = Number(opt("keep", 750));
const VERSION = Number(opt("version", 1));
const REPORT = opt("report", null);
const BACKUP = opt("backup", null);
if (APPLY && !BACKUP) throw new Error("--apply needs --backup <dir>");
if (!REPORT) throw new Error("--report <dir> is required");
mkdirSync(REPORT, { recursive: true });

const DAY_MS = 86400_000;
const nowMs = Math.floor(Date.now() / 60000) * 60000;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Generic bios (already translated in every locale) that fit each persona.
const BIOS = {
  conservative: "متداول متحفظ يركز على الحفاظ على رأس المال أولاً.",
  mediumCareful: "استراتيجية تداول متوسطة المدى تعتمد على إدارة رأس المال بحذر.",
  steadyMonthly: "أستهدف عوائد ثابتة شهريًا عبر استراتيجية منضبطة.",
  goldDay: "متداول يومي متخصص في الذهب والمعادن.",
  forexTa: "أركز على التحليل الفني للأزواج الرئيسية في سوق الفوركس.",
  fundTech: "أعتمد على التحليل الأساسي والفني معًا لاتخاذ قرارات التداول.",
  cryptoShort: "متخصص في صفقات قصيرة المدى على العملات الرقمية الرئيسية.",
  cryptoPro: "متداول محترف متخصص في العملات الرقمية بخبرة تزيد عن 5 سنوات.",
  mediumLowRisk: "أفضّل الصفقات متوسطة الأجل بنسبة مخاطرة منخفضة.",
  strictRisk: "إدارة مخاطر صارمة مع نسبة مخاطرة إلى عائد ثابتة.",
  fxCrypto: "متداول نشط في أسواق الفوركس والعملات الرقمية معًا.",
  highRisk: "متداول عالي المخاطرة يستهدف عوائد كبيرة عبر صفقات قصيرة الأجل شديدة التقلب.",
  breakouts: "أستهدف الاختراقات السعرية القوية، والمخاطرة عندي أعلى من المتوسط بوضوح.",
  leverageCrypto: "أستخدم رافعة مالية مرتفعة على العملات الرقمية بحثًا عن حركات سعرية كبيرة.",
  cryptoSpec: "متداول مضاربة قصيرة الأجل على العملات الرقمية الأكثر تقلبًا في السوق.",
  goldAggressive: "استراتيجية عدوانية على الذهب والمؤشرات مع تقلبات واسعة في العائد الشهري.",
};
const PERSONA_BIOS = {
  gold_scalper: ["steadyMonthly", "strictRisk", "conservative"],
  crypto_scalper: ["cryptoSpec", "highRisk", "leverageCrypto"],
  fx_day: ["forexTa", "steadyMonthly", "strictRisk"],
  gold_momentum: ["goldDay", "strictRisk"],
  crypto_day: ["cryptoShort", "cryptoPro", "fundTech"],
  swing_trend: ["mediumCareful", "fundTech", "strictRisk"],
  crypto_swing_bold: ["breakouts", "leverageCrypto", "cryptoPro"],
  position_conservative: ["conservative", "mediumLowRisk", "steadyMonthly"],
  macro: ["fundTech", "mediumLowRisk", "mediumCareful"],
  overtrader: ["goldDay", "fxCrypto", "goldAggressive"],
  gambler: ["highRisk", "leverageCrypto", "goldAggressive"],
  recovery: ["mediumCareful", "fundTech", "fxCrypto"],
  choppy: ["fxCrypto", "breakouts", "highRisk"],
};
const GENERIC_BIOS = new Set([...Object.values(BIOS), "خبرة طويلة في أسواق الأسهم الأمريكية والمؤشرات العالمية.", "خبرة طويلة في أسواق الأسهم الأمريكية."]);

// Country-specific bios name a market; only personas trading it may keep them.
function bioMarket(bio) {
  if (!bio || GENERIC_BIOS.has(bio)) return null;
  if (bio.includes("العملات الرقمية")) return "crypto";
  if (bio.includes("الذهب")) return "gold";
  if (bio.includes("اليورو مقابل الدولار")) return "eurusd";
  return "other";
}
const MARKET_PERSONAS = {
  crypto: ["crypto_scalper", "crypto_day", "crypto_swing_bold", "gambler"],
  gold: ["gold_scalper", "gold_momentum", "overtrader"],
  eurusd: ["fx_day", "macro", "position_conservative"],
};

// ---------------------------------------------------------------- selection

function assignPersonas(candidates, mustKeep, rng) {
  const slots = Object.fromEntries(PERSONA_KEYS.map((k) => [k, Math.round((PERSONAS[k].count * KEEP) / 750)]));
  let total = Object.values(slots).reduce((a, b) => a + b, 0);
  slots.fx_day += KEEP - total;

  const months = (c) => c.trackDays / 30.4;
  const fits = (c, key) => {
    const P = PERSONAS[key];
    if (P.minTrackMonths && months(c) < P.minTrackMonths) return false;
    const m = bioMarket(c.bio);
    if (m && m !== "other" && !MARKET_PERSONAS[m].includes(key)) return false;
    return true;
  };
  // Preference: scalpers on younger accounts (their trade counts stay sane),
  // losing personas on shorter tracks (losers rarely last for years).
  const pref = (c, key) => {
    const mo = months(c);
    if (key === "gold_scalper" || key === "crypto_scalper") return mo <= 12 ? 3 : mo <= 20 ? 1 : 0.05;
    if (key === "overtrader" || key === "gambler") return mo <= 30 ? 2 : 0.3;
    if (key === "crypto_swing_bold" || key === "recovery") return mo >= 12 ? 1.5 : 1;
    return 1;
  };

  const shuffled = [...candidates].sort(() => rng.float() - 0.5);
  const assigned = new Map();
  const order = ["crypto_swing_bold", "position_conservative", "recovery", "macro", "gold_scalper", "crypto_scalper", "overtrader", "gambler", "swing_trend", "gold_momentum", "choppy", "crypto_day", "fx_day"];

  // Leaders customers already copy or follow are kept first.
  for (const c of shuffled.filter((x) => mustKeep.has(x.id))) {
    const key = order.find((k) => slots[k] > 0 && fits(c, k)) ?? order.find((k) => slots[k] > 0);
    assigned.set(c.id, key);
    slots[key]--;
  }
  for (const key of order) {
    const pool = shuffled.filter((c) => !assigned.has(c.id) && fits(c, key));
    while (slots[key] > 0 && pool.length) {
      // Weighted draw by preference.
      const weights = pool.map((c) => pref(c, key));
      const sum = weights.reduce((a, b) => a + b, 0);
      let r = rng.float() * sum;
      let i = 0;
      while (i < pool.length - 1 && (r -= weights[i]) > 0) i++;
      const c = pool.splice(i, 1)[0];
      assigned.set(c.id, key);
      slots[key]--;
    }
    if (slots[key] > 0) throw new Error(`not enough candidates for ${key}`);
  }
  return assigned;
}

// ---------------------------------------------------------------- generation

function buildDaily(sim, startMs) {
  const dayOf = (ms) => Math.floor(ms / DAY_MS);
  const first = dayOf(startMs);
  const last = dayOf(nowMs);
  const rows = new Map();
  for (let k = first; k <= last; k++)
    rows.set(k, { trades: 0, wins: 0, pnl: 0, gp: 0, gl: 0, wrs: 0, lrs: 0, cash: 0, start: 0 });
  for (const t of sim.trades) {
    if (t.stillOpen) continue;
    const r = rows.get(dayOf(t.exitMs));
    r.trades++;
    r.pnl += t.pnl;
    if (t.pnl > 0) {
      r.wins++;
      r.gp += t.pnl;
      r.wrs += t.returnPct;
    } else {
      r.gl += -t.pnl;
      r.lrs += t.returnPct;
    }
  }
  for (const c of sim.cashFlows) rows.get(Math.min(last, dayOf(c.at))).cash += c.amount;
  let equity = 0;
  const out = [];
  for (const [k, r] of rows) {
    r.start = round2(equity);
    r.pnl = round2(r.pnl);
    equity = r.start + r.cash + r.pnl;
    out.push([k, r]);
  }
  return { daily: out, equity: round2(equity) };
}

const round2 = (x) => Math.round(x * 100) / 100;

// providers.trading_style keeps its old value set; the persona holds the real style.
const LEGACY_STYLE = { scalper: "scalper", day: "moderate", swing: "sporadic", position: "sporadic" };

function generateLeader(c, key, book) {
  const startMs = Math.max(c.startMs, book.s.BTCUSDT.from + 31 * DAY_MS);
  const trackDays = (nowMs - startMs) / DAY_MS;
  let best = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rng = new Rng(`persona:${c.id}:v${VERSION}:${attempt}`);
    const persona = drawPersona(key, rng, { startMs, trackDays });
    const sim = simulateLeader(persona, book, { startMs, endMs: nowMs, seed: persona.seed });
    const v = validateLeader(persona, sim, trackDays);
    const cand = { persona, sim, v, attempt, startMs, trackDays };
    if (v.ok) return cand;
    if (!best || v.violations.length < best.v.violations.length) best = cand;
  }
  return best;
}

// Fixed profit-share steps, by strength (annual return / drawdown, longer
// records count more) inside the persona's allowed steps; the top 30% step
// also needs a record of two years or more.
function assignProfitShare(rows) {
  const strength = (r) => (r.v.metrics.annual / Math.max(0.05, r.v.metrics.mdd)) * Math.min(1, r.trackDays / 730);
  const byPersona = new Map();
  for (const r of rows) (byPersona.get(r.key) ?? byPersona.set(r.key, []).get(r.key)).push(r);
  for (const [key, list] of byPersona) {
    const steps = PERSONAS[key].profitShare;
    list.sort((a, b) => strength(a) - strength(b));
    list.forEach((r, i) => {
      let s = steps[Math.min(steps.length - 1, Math.floor((i / list.length) * steps.length))];
      if (s === 30 && r.trackDays < 730) s = steps.filter((x) => x < 30).pop() ?? 25;
      r.profitShare = s;
    });
  }
}

// ---------------------------------------------------------------- main

async function connect() {
  const c = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
  c.on("error", (err) => log("connection error:", err.message));
  await c.connect();
  return c;
}
let client = await connect();
const q = async (sql, params) => (await client.query(sql, params)).rows;

const candidates = (
  await q(`select id, display_name, bio, country, created_at, is_archived, trading_status, persona from public.providers
           where user_id is null order by id`)
).map((r) => ({ ...r, startMs: new Date(r.created_at).getTime(), trackDays: (nowMs - new Date(r.created_at).getTime()) / DAY_MS }));
const mustKeep = new Set(
  (
    await q(`select distinct p.id from public.providers p where p.user_id is null and (
               exists (select 1 from public.subscriptions s join public.profiles f on f.id = s.follower_id
                       where s.provider_id = p.id and f.account_type = 'demo')
            or exists (select 1 from public.simulated_positions sp join public.signals g on g.id = sp.signal_id
                       where g.provider_id = p.id and sp.account_type = 'demo')
            or exists (select 1 from public.follows fo join public.profiles f on f.id = fo.follower_id
                       where fo.provider_id = p.id and f.account_type = 'demo'))`)
  ).map((r) => r.id),
);
const eligible = candidates.filter((c) => mustKeep.has(c.id) || (!c.is_archived && c.trading_status !== "stopped"));
log(`candidates ${candidates.length}, eligible ${eligible.length}, must keep ${mustKeep.size}`);

// A rerun after the old data was already retired keeps the personas it set.
const resumed = eligible.length === KEEP && eligible.every((c) => c.persona?.v === VERSION);
const assigned = resumed
  ? new Map(eligible.map((c) => [c.id, c.persona.key]))
  : assignPersonas(eligible, mustKeep, new Rng(`rebuild:v${VERSION}`));
const kept = eligible.filter((c) => assigned.has(c.id));
const deleted = candidates.filter((c) => !assigned.has(c.id));
log(`keeping ${kept.length}, deleting ${deleted.length}`);

const fromMs = Date.UTC(2021, 11, 1);
const raw = await ensureCandles(fromMs, nowMs + HOUR, { log });
const book = new PriceBook(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, new HourlySeries(v, fromMs, nowMs + HOUR)])));

const results = [];
let n = 0;
for (const c of kept) {
  const key = assigned.get(c.id);
  const g = generateLeader(c, key, book);
  const { daily, equity } = buildDaily(g.sim, g.startMs);
  const fol = followerSeries(g.persona, daily.map(([k, r]) => [k, { start: r.start, cash: r.cash, pnl: r.pnl }]), g.persona.seed + 1);
  results.push({ id: c.id, c, key, ...g, daily, equity, followers: fol });
  if (++n % 50 === 0) log(`generated ${n}/${kept.length}`);
}
assignProfitShare(results);

// Bios that fit the persona (country-specific bios are kept when compatible).
for (const r of results) {
  const m = bioMarket(r.c.bio);
  if (m && m !== "other") r.bio = r.c.bio;
  else r.bio = BIOS[new Rng(`bio:${r.id}`).pick(PERSONA_BIOS[r.key])];
}

// ---------------------------------------------------------------- report

const csv = [
  "id,name,persona,style,risk,track_months,trades,open_trades,win_rate,rr,total_return,annual,max_dd,max_day,profit_share,min_copy,followers,aum,valid,violations",
];
const dist = {};
let totalTrades = 0;
for (const r of results) {
  const m = r.v.metrics;
  const open = r.sim.trades.filter((t) => t.stillOpen).length;
  totalTrades += r.sim.trades.length;
  const f = r.followers[r.followers.length - 1] ?? { followers: 0, aum: 0 };
  dist[r.key] ??= { n: 0, valid: 0, ret: [] };
  dist[r.key].n++;
  if (r.v.ok) dist[r.key].valid++;
  dist[r.key].ret.push(m.total);
  csv.push(
    [r.id, JSON.stringify(r.c.display_name ?? ""), r.key, r.persona.style, r.persona.risk, (r.trackDays / 30.4).toFixed(1), m.trades, open,
      (m.winRate * 100).toFixed(1), m.rr.toFixed(2), (m.total * 100).toFixed(1), (m.annual * 100).toFixed(1), (m.mdd * 100).toFixed(1),
      (m.maxDay * 100).toFixed(1), r.profitShare, r.persona.min_copy, f.followers, f.aum, r.v.ok, JSON.stringify(r.v.violations.join("; "))].join(","),
  );
}
writeFileSync(join(REPORT, "leaders.csv"), csv.join("\n"));
const summary = Object.entries(dist).map(([k, d]) => {
  const s = [...d.ret].sort((a, b) => a - b);
  return { persona: k, leaders: d.n, valid: d.valid, medianReturnPct: +(s[Math.floor(s.length / 2)] * 100).toFixed(1), winners: s.filter((x) => x > 0.02).length, losers: s.filter((x) => x < -0.02).length };
});
console.table(summary);
log(`total trades ${totalTrades}, deleting ${deleted.length} leaders`);
writeFileSync(join(REPORT, "summary.json"), JSON.stringify({ kept: results.length, deleted: deleted.length, totalTrades, summary }, null, 2));

if (!APPLY) {
  await client.end();
  process.exit(0);
}

// ---------------------------------------------------------------- backup

// Generation takes minutes; start the writes on a fresh connection.
await client.end().catch(() => {});
client = await connect();

// The first run's backup is the one that matters; a resumed run keeps it.
const backupExists = existsSync(join(BACKUP, "providers.jsonl"));
mkdirSync(BACKUP, { recursive: true });
async function dump(table, where = "true") {
  if (backupExists) return;
  const out = createWriteStream(join(BACKUP, `${table}.jsonl`));
  let last = null;
  let count = 0;
  for (;;) {
    const rows = await q(
      `select * from public.${table} where (${where}) ${last ? "and id > $1" : ""} order by id limit 20000`,
      last ? [last] : [],
    );
    if (!rows.length) break;
    for (const r of rows) out.write(JSON.stringify(r) + "\n");
    last = rows[rows.length - 1].id;
    count += rows.length;
  }
  await new Promise((r) => out.end(r));
  log(`backup ${table}: ${count}`);
}
await dump("providers");
await dump("signals");
await dump("simulated_positions");
await dump("subscriptions");
await dump("follows");
await dump("trader_posts");

// ---------------------------------------------------------------- write

const keptIds = results.map((r) => r.id);
const deletedIds = deleted.map((c) => c.id);

async function bulkInsert(table, cols, types, rows) {
  const B = 5000;
  for (let i = 0; i < rows.length; i += B) {
    const chunk = rows.slice(i, i + B);
    const arrays = cols.map((_, j) => chunk.map((r) => r[j]));
    await client.query(
      `insert into public.${table} (${cols.join(", ")}) select * from unnest(${types.map((t, j) => `$${j + 1}::${t}[]`).join(", ")})`,
      arrays,
    );
  }
}

const breakeven = (t) => t.trigger !== "tp" && t.trigger !== "sl" && Math.abs(t.exit - t.entry) <= t.entry * 0.0002;
const iso = (ms) => new Date(ms).toISOString();
const dayIso = (k) => new Date(k * DAY_MS).toISOString().slice(0, 10);

// The connection to the pooler can drop on a long transaction, so the writes
// are split: one short transaction retires the old data, then each chunk of
// leaders (trades, plans, cash flows, daily rows and the money fields on
// providers) is committed on its own. A chunk already written (it has daily
// rows) is skipped, so a rerun resumes where a dropped run stopped.

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

async function tx(fn) {
  await client.query("begin");
  try {
    await client.query("set local statement_timeout = 0");
    const out = await fn();
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  }
}

// Triggers off for the current transaction only (no table lock).
const triggers = (on) => client.query(`set local session_replication_role = ${on ? "origin" : "replica"}`);

// ---- 1. retire the old data
const alreadyRetired = (await q("select count(*)::int n from public.providers where is_simulated"))[0].n === results.length;
if (!alreadyRetired) {
  await withRetry("retire", () =>
    tx(async () => {
      // Old internal test data: real-account copies of simulated leaders.
      const realPos = await client.query(`delete from public.simulated_positions sp using public.signals g, public.providers p
        where g.id = sp.signal_id and p.id = g.provider_id and p.is_simulated and sp.account_type = 'real'
        returning sp.status`);
      log(`deleted real-account positions: ${realPos.rows.filter((r) => r.status === "open").length} open, ${realPos.rows.filter((r) => r.status === "closed").length} closed`);
      await client.query(`delete from public.subscriptions s using public.providers p, public.profiles f
        where p.id = s.provider_id and p.is_simulated and f.id = s.follower_id and f.account_type = 'real'`);
      await client.query(`delete from public.follows fo using public.providers p, public.profiles f
        where p.id = fo.provider_id and p.is_simulated and f.id = fo.follower_id and f.account_type <> 'demo'`);

      // Demo positions still open on a retired trade close at the live price.
      const openDemo = (
        await client.query(`select sp.id, mp.price from public.simulated_positions sp
          join public.signals g on g.id = sp.signal_id join public.providers p on p.id = g.provider_id
          join public.market_prices mp on mp.symbol = g.symbol
          where p.is_simulated and sp.status = 'open'`)
      ).rows;
      for (const r of openDemo) await client.query("select public.settle_copied_position($1, $2, now(), 'leader')", [r.id, r.price]);
      log(`closed ${openDemo.length} open demo position(s) at the live price`);

      // The old trades: the ones a customer copied stay (hidden) for that
      // customer's history, the rest go.
      await client.query(`delete from public.trader_posts tp using public.providers p where p.id = tp.provider_id and p.is_simulated`);
      await triggers(false);
      await client.query(`update public.signals g set hidden = true,
          status = 'closed',
          exit_price = coalesce(g.exit_price, (select price from public.market_prices mp where mp.symbol = g.symbol), g.entry_price),
          closed_at = coalesce(g.closed_at, now()),
          close_trigger = coalesce(g.close_trigger, 'manual')
        from public.providers p where p.id = g.provider_id and p.is_simulated
          and exists (select 1 from public.simulated_positions sp where sp.signal_id = g.id)`);
      const delSig = await client.query(`delete from public.signals g using public.providers p where p.id = g.provider_id and p.is_simulated
          and not exists (select 1 from public.simulated_positions sp where sp.signal_id = g.id)`);
      log(`deleted ${delSig.rowCount} old trades`);
      await triggers(true);

      // Leaders not kept.
      await client.query("delete from public.follows where provider_id = any($1)", [deletedIds]);
      await client.query("delete from public.subscriptions where provider_id = any($1)", [deletedIds]);
      await client.query("delete from public.provider_daily where provider_id = any($1)", [keptIds.concat(deletedIds)]);
      await client.query("delete from public.provider_cash_flows where provider_id = any($1)", [keptIds.concat(deletedIds)]);
      const delProv = await client.query("delete from public.providers where id = any($1)", [deletedIds]);
      log(`deleted ${delProv.rowCount} leaders`);

      // Persona, bio, profit share and the other fixed settings.
      await triggers(false);
      for (const r of results) {
        const bias = Object.entries(r.persona.assets).sort((a, b) => b[1] - a[1]).map(([s]) => s);
        await client.query(
          `update public.providers set persona = $2, bio = $3, profit_share_pct = $4, min_copy_amount = $5,
             trading_status = 'active', is_archived = false, margin_called_at = null, margin_call_count = 0,
             symbol_bias = $6, risk_archetype = $7, trading_style = $8, rr_ratio = $9,
             activity_weight = null, session_start_hour = null, session_end_hour = null,
             account_capital = 0, total_profit = 0, total_withdrawals = 0, base_followers_count = 0, total_volume = 0
           where id = $1`,
          [r.id, r.persona, r.bio, r.profitShare, r.persona.min_copy, bias, r.persona.risk, LEGACY_STYLE[r.persona.style], r.persona.rr],
        );
      }
      log("retired the old data and set the personas");
    }),
  );
}

// ---- 2. each leader's history, in chunks
const done = new Set((await q("select distinct provider_id from public.provider_daily where provider_id = any($1)", [keptIds])).map((r) => r.provider_id));
const todo = results.filter((r) => !done.has(r.id));
log(`writing ${todo.length} leaders (${done.size} already written)`);
const CHUNK = 15;
const MAX_DB_MB = Number(opt("max-db-mb", 850));
for (let i = 0; i < todo.length; i += CHUNK) {
  const chunk = todo.slice(i, i + CHUNK);
  // Never fill the disk: Supabase turns the database read-only when it is full.
  const sizeMb = (await withRetry("size", () => q("select pg_database_size(current_database()) / 1048576 as mb")))[0].mb;
  if (sizeMb > MAX_DB_MB) throw new Error(`database at ${sizeMb} MB, over the ${MAX_DB_MB} MB guard; stopping (rerun resumes)`);
  const sigRows = [];
  const planRows = [];
  for (const r of chunk) {
    for (const t of r.sim.trades) {
      const id = randomUUID();
      if (t.stillOpen) {
        sigRows.push([id, r.id, t.sym, t.side, t.entry, t.sl, t.tp, null, "open", iso(t.openMs), null, t.lot, null, null, null, null, null]);
        const planned = t.openMs + t.holdMin * 60000;
        planRows.push([id, t.planWin, t.lossHindsight, t.holdMin, t.take, t.riskPct, t.equityAtOpen, iso(planned), iso(Math.max(planned, nowMs)), iso(nowMs)]);
      } else {
        sigRows.push([id, r.id, t.sym, t.side, t.entry, t.sl, t.tp, t.exit, "closed", iso(t.openMs), iso(t.exitMs), t.lot,
          breakeven(t) ? "breakeven" : t.trigger, t.commission, t.swap, t.pnl, t.returnPct]);
      }
    }
  }
  const cfRows = chunk.flatMap((r) => r.sim.cashFlows.map((c) => [r.id, iso(Math.min(c.at, nowMs)), c.amount, c.kind]));
  const dailyRows = chunk.flatMap((r) =>
    r.daily.map(([k, d], j) => [r.id, dayIso(k), d.trades, d.wins, d.pnl, round2(d.gp), round2(d.gl), round2(d.wrs * 1e4) / 1e4,
      round2(d.lrs * 1e4) / 1e4, d.cash, d.start, r.followers[j].followers, r.followers[j].aum]),
  );
  const ids = chunk.map((r) => r.id);
  await withRetry(`chunk ${i / CHUNK + 1}`, () =>
    tx(async () => {
      await triggers(false);
      // A previous, dropped attempt of this chunk may have left rows behind.
      await client.query("delete from public.signals where provider_id = any($1) and not hidden", [ids]);
      await client.query("delete from public.provider_cash_flows where provider_id = any($1)", [ids]);
      await bulkInsert(
        "signals",
        ["id", "provider_id", "symbol", "side", "entry_price", "stop_loss", "take_profit", "exit_price", "status", "opened_at", "closed_at",
          "lot_size", "close_trigger", "commission", "swap", "pnl_usd", "return_pct"],
        ["uuid", "uuid", "text", "text", "numeric", "numeric", "numeric", "numeric", "text", "timestamptz", "timestamptz", "numeric", "text",
          "numeric", "numeric", "numeric", "numeric"],
        sigRows,
      );
      await bulkInsert(
        "sim_trade_plans",
        ["signal_id", "plan_win", "loss_hindsight", "hold_min", "take_frac", "risk_pct", "equity_at_open", "planned_close_at", "next_check_at", "checked_at"],
        ["uuid", "boolean", "boolean", "int", "numeric", "numeric", "numeric", "timestamptz", "timestamptz", "timestamptz"],
        planRows,
      );
      await bulkInsert("provider_cash_flows", ["provider_id", "at", "amount", "kind"], ["uuid", "timestamptz", "numeric", "text"], cfRows);
      await bulkInsert(
        "provider_daily",
        ["provider_id", "day", "trades", "wins", "pnl", "gross_profit", "gross_loss", "win_ret_sum", "loss_ret_sum", "cash_flow", "start_equity", "followers", "aum"],
        ["uuid", "date", "int", "int", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "numeric", "int", "numeric"],
        dailyRows,
      );
      // Close reasons normalised exactly like signals_integrity_guard does.
      await client.query(
        `update public.signals g
           set close_trigger = public.trade_close_trigger(g.side, g.entry_price, g.exit_price, g.stop_loss, g.take_profit, g.close_trigger)
         where g.provider_id = any($1) and g.status = 'closed' and not g.hidden
           and g.close_trigger is distinct from public.trade_close_trigger(g.side, g.entry_price, g.exit_price, g.stop_loss, g.take_profit, g.close_trigger)`,
        [ids],
      );
      for (const r of chunk) {
        const closed = r.sim.trades.filter((t) => !t.stillOpen);
        await client.query(
          `update public.providers set account_capital = $2, total_profit = $3, total_withdrawals = $4,
             base_followers_count = $5, total_volume = $6 where id = $1`,
          [
            r.id,
            r.equity,
            round2(closed.reduce((a, t) => a + t.pnl, 0)),
            round2(-r.sim.cashFlows.filter((c) => c.amount < 0).reduce((a, c) => a + c.amount, 0)),
            (r.followers[r.followers.length - 1] ?? { followers: 0 }).followers,
            round2(r.sim.trades.reduce((a, t) => a + notionalUsd(t.sym, t.lot, t.entry), 0)),
          ],
        );
      }
    }),
  );
  if ((i / CHUNK) % 10 === 0) log(`written ${Math.min(i + CHUNK, todo.length)}/${todo.length}`);
}
log("all leaders written");

// ---- 3. symbol volatility, real leaders, stats, schedules
await withRetry("finish", () =>
  tx(async () => {
    // Live stop distances start from the volatility the history ended on.
    for (const sym of Object.keys(book.s)) {
      await client.query("update public.sim_symbols set sigma_h = $2 where symbol = $1", [sym, book.sigmaAt(sym, nowMs - HOUR)]);
    }
    // Real leaders: their closed trades get their net result, and
    // provider_daily is built from them.
    await triggers(false);
    await client.query(`update public.signals g set pnl_usd = round(coalesce(public.trade_profit_usd(g.symbol, g.side, g.entry_price, g.exit_price, g.lot_size), 0)
          - coalesce(g.commission, 0) + coalesce(g.swap, 0), 2)
        from public.providers p where p.id = g.provider_id and not p.is_simulated and g.status = 'closed' and g.pnl_usd is null`);
    await client.query(`with t as (
        select g.provider_id, (g.closed_at at time zone 'UTC')::date d, count(*) n, count(*) filter (where g.pnl_usd > 0) w,
               sum(g.pnl_usd) pnl, sum(greatest(g.pnl_usd, 0)) gp, sum(greatest(-g.pnl_usd, 0)) gl
        from public.signals g join public.providers p on p.id = g.provider_id
        where not p.is_simulated and g.status = 'closed' and not g.hidden and not g.created_by_admin
        group by 1, 2)
      insert into public.provider_daily (provider_id, day, trades, wins, pnl, gross_profit, gross_loss, start_equity)
      select t.provider_id, t.d, t.n, t.w, t.pnl, t.gp, t.gl,
             greatest(0, p.account_capital - coalesce(sum(t.pnl) over (partition by t.provider_id), 0))
               + coalesce(sum(t.pnl) over (partition by t.provider_id order by t.d rows between unbounded preceding and 1 preceding), 0)
      from t join public.providers p on p.id = t.provider_id
      on conflict (provider_id, day) do nothing`);
    await triggers(true);
  }),
);
await withRetry("stats", () => client.query("select public.refresh_provider_stats(null, true)"));
log("stats refreshed");

// Live engine and nightly maintenance.
await withRetry("schedule", async () => {
  await client.query("select cron.unschedule(jobid) from cron.job where jobname in ('run-market-simulation', 'daily-leader-maintenance')");
  await client.query(`select cron.schedule('run-market-simulation', '* * * * *', 'select public.run_market_simulation();')`);
  await client.query(`select cron.schedule('daily-leader-maintenance', '5 0 * * *', 'select public.run_daily_leader_maintenance();')`);
});
log("engine scheduled");

// Audit rows of the deleted trades, in small batches.
for (;;) {
  const r = await withRetry("audit", () =>
    client.query(`delete from public.trade_audit_log where id in (
        select a.id from public.trade_audit_log a where a.table_name = 'signals'
          and not exists (select 1 from public.signals g where g.id = a.row_id) limit 20000)`),
  );
  if (r.rowCount === 0) break;
}
log("audit log cleaned");
await client.end();
