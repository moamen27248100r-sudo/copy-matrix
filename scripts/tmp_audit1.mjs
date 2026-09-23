import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });
const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

console.log("=== A) Date sanity ===");
console.log("closed before opened:", (await c.query(`select count(*) from signals where closed_at is not null and closed_at < opened_at`)).rows[0]);
console.log("future opened_at:", (await c.query(`select count(*) from signals where opened_at > now() + interval '1 hour'`)).rows[0]);
console.log("future closed_at:", (await c.query(`select count(*) from signals where closed_at > now() + interval '1 hour'`)).rows[0]);
console.log("null opened_at:", (await c.query(`select count(*) from signals where opened_at is null`)).rows[0]);
console.log("date range:", (await c.query(`select min(opened_at), max(closed_at) from signals`)).rows[0]);

console.log("=== B) TP/SL vs actual exit_price consistency ===");
console.log("close_trigger=tp but exit_price != take_profit:", (await c.query(`
  select count(*) from signals where status='closed' and close_trigger='tp' and take_profit is not null
  and abs(exit_price - take_profit) > 0.01
`)).rows[0]);
console.log("close_trigger=sl but exit_price != stop_loss:", (await c.query(`
  select count(*) from signals where status='closed' and close_trigger='sl' and stop_loss is not null
  and abs(exit_price - stop_loss) > 0.01
`)).rows[0]);
console.log("close_trigger=tp but take_profit is null:", (await c.query(`select count(*) from signals where close_trigger='tp' and take_profit is null`)).rows[0]);
console.log("close_trigger=sl but stop_loss is null:", (await c.query(`select count(*) from signals where close_trigger='sl' and stop_loss is null`)).rows[0]);

console.log("=== C) Price sanity ===");
console.log("zero/negative prices:", (await c.query(`select count(*) from signals where entry_price <= 0 or (exit_price is not null and exit_price <= 0)`)).rows[0]);
console.log("--- price range per symbol vs entry_price range ---");
console.log((await c.query(`select symbol, min(entry_price) mn, max(entry_price) mx, count(*) n from signals group by symbol order by symbol`)).rows);

await c.end();
