// One-time supplementary backfill closing the gap between the original
// historical backfill's cutoff and whenever the live per-minute
// price-fetch cron (0076) actually started appending forward — that
// left a multi-hour dead zone in price_history right before "now",
// which the lagged open-order entry price (0081) could occasionally
// reach into, producing a much bigger lag than intended (3-60 min).
// Pulls dense recent Binance klines (1-minute, last ~36h) for
// crypto+gold so that window is fully real, not synthetic.
//
// Usage: node scripts/backfill-recent-price-gap.mjs
const BINANCE_SYMBOLS = {
  BTCUSDT: "BTCUSDT",
  ETHUSDT: "ETHUSDT",
  SOLUSDT: "SOLUSDT",
  BNBUSDT: "BNBUSDT",
  XRPUSDT: "XRPUSDT",
  XAUUSD: "PAXGUSDT",
};

import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const HOURS_BACK = 36;
const endTime = Date.now();
const startTime = endTime - HOURS_BACK * 60 * 60 * 1000;

for (const [outSymbol, binanceSymbol] of Object.entries(BINANCE_SYMBOLS)) {
  console.log(`\n=== ${outSymbol} (${binanceSymbol}) ===`);
  let cursor = startTime;
  const rows = [];
  while (cursor < endTime) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1m&startTime=${cursor}&endTime=${endTime}&limit=1000`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  fetch failed: ${res.status} ${await res.text()}`);
      break;
    }
    const klines = await res.json();
    if (!klines.length) break;
    for (const k of klines) {
      rows.push({ ts: new Date(k[0]).toISOString(), price: Number(k[4]) }); // close price
    }
    const lastOpenTime = klines[klines.length - 1][0];
    if (klines.length < 1000) break;
    cursor = lastOpenTime + 60_000;
  }
  console.log(`  fetched ${rows.length} 1-minute points`);

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map((_, j) => `($${j * 3 + 1}::text, $${j * 3 + 2}::timestamptz, $${j * 3 + 3}::numeric)`).join(",");
    const params = chunk.flatMap((r) => [outSymbol, r.ts, r.price]);
    await db.query(
      `insert into public.price_history (symbol, ts, price) values ${values} on conflict (symbol, ts) do nothing`,
      params,
    );
    process.stdout.write(`\r  inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log("");
}

await db.end();
console.log("\ndone");
