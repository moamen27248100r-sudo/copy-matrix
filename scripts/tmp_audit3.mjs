import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });
const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

console.log("=== D) TP/SL directional sanity (buy: tp>entry>sl, sell: tp<entry<sl) ===");
console.log("buy with tp <= entry:", (await c.query(`select count(*) from signals where side='buy' and take_profit is not null and take_profit <= entry_price`)).rows[0]);
console.log("buy with sl >= entry:", (await c.query(`select count(*) from signals where side='buy' and stop_loss is not null and stop_loss >= entry_price`)).rows[0]);
console.log("sell with tp >= entry:", (await c.query(`select count(*) from signals where side='sell' and take_profit is not null and take_profit >= entry_price`)).rows[0]);
console.log("sell with sl <= entry:", (await c.query(`select count(*) from signals where side='sell' and stop_loss is not null and stop_loss <= entry_price`)).rows[0]);

console.log("=== E) synthetic_customers capital consistency spot check ===");
console.log((await c.query(`select count(*) filter (where current_capital < 0) neg, count(*) filter (where current_capital is null) nulls, count(*) total from synthetic_customers`)).rows[0]);
console.log("--- starting > current by a huge factor (red flag)? ---");
console.log((await c.query(`select count(*) from synthetic_customers where current_capital > starting_capital * 50`)).rows[0]);

console.log("=== F) withdrawal sanity ===");
console.log((await c.query(`select count(*) from synthetic_customer_withdrawals where amount <= 0`)).rows[0]);
console.log("--- withdrawal larger than customer's starting_capital*10? ---");
console.log((await c.query(`
  select count(*) from synthetic_customer_withdrawals w
  join synthetic_customers sc on sc.id = w.customer_id
  where w.amount > sc.starting_capital * 10
`)).rows[0]);

console.log("=== G) provider_cards derived stats still computing cleanly ===");
console.log((await c.query(`select count(*) from provider_cards where win_rate_pct is not null and (win_rate_pct < 0 or win_rate_pct > 100)`)).rows[0]);
console.log((await c.query(`select display_name, rating_score, tier, win_rate_pct, avg_daily_return_pct from provider_cards order by random() limit 5`)).rows);

await c.end();
