// Dry run and tests of migration 0270 (account hardening) inside ONE rolled-back transaction.
//   node scripts/check-migration-0270.mjs           -> applies the migration in the transaction first
//   node scripts/check-migration-0270.mjs --live    -> tests what is already in the database
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const live = process.argv.includes("--live");
const sql = readFileSync("supabase/migrations/0270_account_hardening.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => (typeof pass === "object" ? results.push({ name, pass: pass.pass, extra: pass.extra }) : results.push({ name, pass, extra: String(extra) }));
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.011;

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;
// the error code of a statement (or null), without aborting the transaction
async function code(fn) {
  await c.query("savepoint e");
  try {
    await fn();
    await c.query("release savepoint e");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint e");
    return e.code ?? e.message;
  }
}
async function expectCode(fn, want) {
  const got = await code(fn);
  return { pass: got === want, extra: "got " + got };
}
async function as(uid, fn) {
  await c.query("savepoint s");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
  try {
    const r = await fn();
    await c.query("release savepoint s");
    return r;
  } catch (e) {
    await c.query("rollback to savepoint s");
    throw e;
  } finally {
    await c.query("reset role");
  }
}
const newUser = async (email, meta = {}, app = {}) => {
  const id = randomUUID();
  await c.query(
    "insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, $3::jsonb, $4::jsonb, now(), now())",
    [id, email, JSON.stringify(app), JSON.stringify(meta)],
  );
  return id;
};

await c.query("begin");
try {
  await c.query("set local statement_timeout = 0");
  if (!live) await c.query(sql);

  ok("every existing account is marked verified (grandfathered)", Number((await q("select count(*) n from profiles p where p.email_verified_at is null and p.created_at < now() - interval '1 minute'"))[0].n) === 0);
  const dup = await q("select count(*)::int n from (select phone from profiles where phone is not null group by 1 having count(*) > 1) d");
  ok("no phone number is shared by two accounts", dup[0].n === 0, dup[0].n);

  // sign-up: e-mail stored normalised, phone ignored, not verified
  const tag = randomUUID().slice(0, 8);
  const a = await newUser(`  Mixed.${tag}@Example.test `, { phone: "+966500000000", display_name: "Dry" });
  const pa = (await q("select email, phone, email_verified_at from profiles where id = $1", [a]))[0];
  ok("e-mail is stored trimmed and lowercase", pa.email === `mixed.${tag}@example.test`, pa.email);
  ok("a phone number in the sign-up metadata is ignored", pa.phone === null, pa.phone);
  ok("a new account is not verified", pa.email_verified_at === null);
  const g = await newUser(`g.${tag}@example.test`, { email_verified: "true" }, { provider: "google" });
  ok("a Google account (provider-verified address) is verified", (await q("select email_verified_at from profiles where id = $1", [g]))[0].email_verified_at !== null);
  const dupEmail = await code(() => newUser(`MIXED.${tag}@EXAMPLE.test`));
  ok("the same e-mail in other letters cannot sign up again", dupEmail !== null, dupEmail);

  // phone: validated and unique
  const b = await newUser(`b.${tag}@example.test`);
  ok("a valid phone is saved", (await as(a, async () => { await c.query("select set_my_phone('+201001234567')"); return (await q("select phone from profiles where id = $1", [a]))[0].phone; })) === "+201001234567");
  ok("a phone without the + country code is refused", await expectCode(() => as(b, () => c.query("select set_my_phone('0100123456')")), "CM072"));
  ok("letters in a phone are refused", await expectCode(() => as(b, () => c.query("select set_my_phone('+20abc1234567')")), "CM072"));
  ok("a phone already used by another account is refused", await expectCode(() => as(b, () => c.query("select set_my_phone('+201001234567')")), "CM073"));
  ok("a customer cannot write the phone column directly", (await code(() => as(b, () => c.query("update profiles set phone = '+201009999999' where id = $1", [b])))) !== null);
  ok("a customer cannot mark their own e-mail verified", (await code(() => as(b, () => c.query("update profiles set email_verified_at = now() where id = $1", [b])))) !== null);

  // balances never below zero
  await c.query("update profiles set balance = 50 where id = $1", [b]);
  ok("a balance cannot be set below zero", await expectCode(() => c.query("update profiles set balance = -1 where id = $1", [b]), "23514"));
  ok("the other wallet cannot be set below zero", await expectCode(() => c.query("update profiles set other_balance = -1 where id = $1", [b]), "23514"));

  // demo deposit / withdrawal amounts
  await c.query("update profiles set account_type = 'demo', balance = 1000 where id = $1", [b]);
  ok("demo deposit below 1 refused", await expectCode(() => as(b, () => c.query("select demo_deposit(0.5)")), "CM001"));
  ok("demo deposit with three decimals refused", await expectCode(() => as(b, () => c.query("select demo_deposit(10.123)")), "CM001"));
  ok("demo deposit of 25.50 works", near((await as(b, async () => (await q("select demo_deposit(25.5) v"))[0].v)), 1025.5));
  ok("demo withdrawal with three decimals refused", await expectCode(() => as(b, () => c.query("select demo_withdraw(10.123)")), "CM001"));
  ok("demo withdrawal above the balance refused", await expectCode(() => as(b, () => c.query("select demo_withdraw(999999)")), "CM006"));

  // real money needs a verified e-mail
  await c.query("update profiles set account_type = 'real', email_verified_at = null where id = $1", [b]);
  await c.query("update platform_settings set value = 'true'::jsonb where key = 'deposits_enabled'");
  ok("a real deposit needs a verified e-mail", await expectCode(() => c.query("select crypto_deposit_submit($1, 'TRC20', $2)", [b, "a".repeat(64)]), "CM071"));
  ok("a real withdrawal needs a verified e-mail", (await code(() => as(b, () => c.query("select request_crypto_withdrawal('TRC20', 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7', 20)")))) !== null);

  // a loss bigger than the wallet takes it to zero, not below
  const uid = await newUser(`loss.${tag}@example.test`);
  await c.query("update profiles set balance = 50, account_type = 'demo' where id = $1", [uid]);
  const price = Number((await q("select price from market_prices where symbol = 'BTCUSDT'"))[0].price);
  const lead = (await q("insert into providers (display_name, is_simulated, account_capital, persona, min_copy_amount) values ('Dry run leader', true, 1000, $1::jsonb, 10) returning id", [JSON.stringify({ lev: 20 })]))[0].id;
  const sub = (await q("insert into subscriptions (follower_id, provider_id, allocated_amount, copy_mode, max_drawdown_pct) values ($1, $2, 50, 'ratio', 100) returning id", [uid, lead]))[0].id;
  await q("insert into signals (provider_id, symbol, side, entry_price, lot_size, status, opened_at) values ($1, 'BTCUSDT', 'buy', $2, $3, 'open', now())", [lead, price, 20000 / price]);
  const pos = (await q("select id, size, margin from simulated_positions where subscription_id = $1", [sub]))[0];
  ok("the copied trade was opened (margin 50, exposure 1000)", !!pos && near(pos.margin, 50) && near(pos.size, 1000), JSON.stringify(pos));
  if (pos) {
    await c.query("update simulated_positions set opened_at = now() - interval '1 hour' where id = $1", [pos.id]);
    await c.query("select settle_copied_position($1, $2, now(), 'leader')", [pos.id, price * 0.8]);
    const after = (await q("select balance from profiles where id = $1", [uid]))[0].balance;
    const tx = (await q("select amount, balance_after from wallet_transactions where user_id = $1 and type = 'pnl' order by created_at desc limit 1", [uid]))[0];
    ok("a loss bigger than the wallet leaves zero, not a negative balance", Number(after) === 0, after);
    ok("the wallet entry records what was actually taken (-50)", tx && near(tx.amount, -50) && Number(tx.balance_after) === 0, JSON.stringify(tx));
  }

  // failed-attempt limits and idempotency
  const key = `login-fail:${tag}`;
  for (let i = 0; i < 5; i++) await c.query("select rate_limit_record($1)", [key]);
  ok("blocked after 5 recorded failures in the window", (await q("select rate_limit_blocked($1, 5, 900) b", [key]))[0].b === true);
  ok("not blocked below the limit", (await q("select rate_limit_blocked($1, 6, 900) b", [key]))[0].b === false);
  await c.query("select rate_limit_clear($1)", [key]);
  ok("cleared after a success", (await q("select rate_limit_blocked($1, 1, 900) b", [key]))[0].b === false);
  const first = await as(b, async () => (await q("select claim_idempotency_key('key-0123456789') k"))[0].k);
  const second = await as(b, async () => (await q("select claim_idempotency_key('key-0123456789') k"))[0].k);
  ok("an idempotency key is claimed once", first === true && second === false, `${first}/${second}`);
  await as(b, () => c.query("select release_idempotency_key('key-0123456789')"));
  ok("a released key can be used again", (await as(b, async () => (await q("select claim_idempotency_key('key-0123456789') k"))[0].k)) === true);
  ok("the rate-limit functions are closed to customers", await expectCode(() => as(b, () => c.query("select rate_limit_blocked('x', 1, 1)")), "42501"));
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
