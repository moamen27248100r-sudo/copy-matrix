// One-time backfill of public.price_history with real historical prices:
//   - crypto + gold (via PAXGUSDT -> XAUUSD): Binance hourly klines,
//     storing the real open/high/low/close of each candle as four
//     separate real price points (so later "find the real extreme in
//     this window" logic has genuine intra-hour highs/lows to find,
//     not just hourly closes).
//   - forex (EUR/GBP/JPY vs USD): frankfurter.app's daily historical
//     range, its native resolution.
// Safe to re-run — upserts on (symbol, ts).
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const START = Date.UTC(2022, 0, 15);
const END = Date.now();

const CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "PAXGUSDT"];
const HOUR_MS = 60 * 60 * 1000;
const KLINE_LIMIT = 1000;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function backfillCrypto(client, binanceSymbol) {
  const outSymbol = binanceSymbol === "PAXGUSDT" ? "XAUUSD" : binanceSymbol;
  let cursor = START;
  let totalRows = 0;
  while (cursor < END) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1h&limit=${KLINE_LIMIT}&startTime=${cursor}`;
    const klines = await fetchJson(url);
    if (!Array.isArray(klines) || klines.length === 0) break;

    const rows = [];
    for (const k of klines) {
      const [openTime, open, high, low, close] = k;
      rows.push([outSymbol, new Date(openTime), Number(open)]);
      rows.push([outSymbol, new Date(openTime + HOUR_MS * 0.25), Number(high)]);
      rows.push([outSymbol, new Date(openTime + HOUR_MS * 0.5), Number(low)]);
      rows.push([outSymbol, new Date(openTime + HOUR_MS * 0.75), Number(close)]);
    }

    const values = [];
    const params = [];
    rows.forEach(([sym, ts, price], i) => {
      values.push(`($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`);
      params.push(sym, ts, price);
    });
    await client.query(
      `insert into public.price_history (symbol, ts, price) values ${values.join(",")}
       on conflict (symbol, ts) do update set price = excluded.price`,
      params,
    );
    totalRows += rows.length;

    const lastOpenTime = klines[klines.length - 1][0];
    cursor = lastOpenTime + HOUR_MS;
    process.stdout.write(`\r${binanceSymbol}: ${new Date(cursor).toISOString().slice(0, 10)} (${totalRows} rows so far)`);
    if (klines.length < KLINE_LIMIT) break;
  }
  console.log(`\n${outSymbol}: done, ${totalRows} rows`);
}

async function backfillForex(client) {
  const startStr = new Date(START).toISOString().slice(0, 10);
  const endStr = new Date(END).toISOString().slice(0, 10);
  const url = `https://api.frankfurter.app/${startStr}..${endStr}?from=USD&to=EUR,GBP,JPY`;
  const data = await fetchJson(url);
  const rates = data.rates || {};

  const rows = [];
  for (const [dateStr, r] of Object.entries(rates)) {
    const ts = new Date(dateStr + "T12:00:00Z");
    if (r.EUR) rows.push(["EURUSD", ts, 1 / r.EUR]);
    if (r.GBP) rows.push(["GBPUSD", ts, 1 / r.GBP]);
    if (r.JPY) rows.push(["USDJPY", ts, r.JPY]);
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    chunk.forEach(([sym, ts, price], j) => {
      values.push(`($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`);
      params.push(sym, ts, price);
    });
    await client.query(
      `insert into public.price_history (symbol, ts, price) values ${values.join(",")}
       on conflict (symbol, ts) do update set price = excluded.price`,
      params,
    );
  }
  console.log(`forex: done, ${rows.length} rows`);
}

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

for (const sym of CRYPTO_SYMBOLS) {
  await backfillCrypto(client, sym);
}
await backfillForex(client);

const { rows: counts } = await client.query(
  `select symbol, count(*) as n, min(ts) as earliest, max(ts) as latest from public.price_history group by symbol order by symbol`,
);
console.log(counts);

await client.end();
