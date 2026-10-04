// Demo / real wallet separation (0226-0229) against SUPABASE_DB_URL. Everything
// runs inside one transaction that is always rolled back. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const USER = "00000000-0000-4000-8000-0000000000c1";

async function asUser(fn) {
  await db.query("savepoint s");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: USER, role: "authenticated" })]);
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}

async function fails(code, fn) {
  await db.query("savepoint f");
  await assert.rejects(fn, (e) => (code ? e.code === code : true));
  await db.query("rollback to f");
}

const profile = async () => (await db.query("select account_type, balance::float b, other_balance::float o from public.profiles where id=$1", [USER])).rows[0];

before(async () => {
  await db.connect();
  await db.query("begin");
  await db.query(
    "insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,'wallet-test@example.test','{\"account_type\":\"demo\"}','authenticated','authenticated')",
    [USER],
  );
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

test("a new account starts with 10,000 demo and an empty real wallet", async () => {
  assert.deepEqual(await profile(), { account_type: "demo", b: 10000, o: 0 });
});

test("demo deposit / withdraw are instant and capped", async () => {
  await asUser(() => db.query("select demo_deposit(500)"));
  assert.equal((await profile()).b, 10500);
  await asUser(() => db.query("select demo_withdraw(200)"));
  assert.equal((await profile()).b, 10300);
  await asUser(() => fails("CM011", () => db.query("select demo_deposit(2000000)")));
  await asUser(() => fails("CM006", () => db.query("select demo_withdraw(99999999)")));
  await asUser(() => db.query("select reset_demo_balance()"));
  assert.equal((await profile()).b, 10000);
});

test("demo operations never touch the real wallet; switching only swaps", async () => {
  await asUser(() => db.query("select demo_deposit(1000)"));
  assert.equal((await profile()).o, 0);
  await asUser(() => db.query("select switch_account_type('real')"));
  assert.deepEqual(await profile(), { account_type: "real", b: 0, o: 11000 });
  await asUser(() => fails("CM014", () => db.query("select demo_deposit(5)")));
  await asUser(() => fails("CM014", () => db.query("select reset_demo_balance()")));
  await asUser(() => db.query("select switch_account_type('demo')"));
  assert.deepEqual(await profile(), { account_type: "demo", b: 11000, o: 0 });
});

test("a user cannot raise a balance directly or create wallet requests", async () => {
  await asUser(() => fails("42501", () => db.query("update public.profiles set balance = 999999 where id = $1", [USER])));
  await asUser(() => fails("42501", () => db.query("update public.profiles set other_balance = 999999 where id = $1", [USER])));
  await asUser(() => db.query("select switch_account_type('real')"));
  // Manual wallet requests are retired (0233): deposits come only from verified TxIDs.
  await asUser(() => fails("42501", () => db.query("insert into public.wallet_requests(user_id,type,amount) values ($1,'deposit',100)", [USER])));
  await asUser(() => fails("42501", () => db.query("insert into public.crypto_deposits(user_id,network,tx_hash,deposit_address,required_confirmations,status,amount) values ($1,'TRC20',repeat('1',64),'x',1,'completed',500)", [USER])));
  assert.equal((await profile()).b, 0);
});

test("a completed real deposit credits only the real wallet, even after switching to demo", async () => {
  await db.query("update public.crypto_networks set deposit_address = 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7', deposit_enabled = true where id = 'TRC20'");
  const { rows: [d] } = await db.query("select id from public.crypto_deposit_submit($1,'TRC20',repeat('2',64))", [USER]);
  await asUser(() => db.query("select switch_account_type('demo')"));
  await db.query("select public.crypto_deposit_record_check($1, $2)", [d.id, JSON.stringify({ state: "found", amount: "100", confirmations: 99, block: 1 })]);
  assert.deepEqual(await profile(), { account_type: "demo", b: 11000, o: 100 });
});

test("notification preferences suppress only the chosen category", async () => {
  await db.query("insert into public.notification_preferences(user_id, category, in_app) values ($1,'copy',false)", [USER]);
  await db.query("insert into public.notifications(user_id,type,title,body) values ($1,'copy_closed','t','b')", [USER]);
  await db.query("insert into public.notifications(user_id,type,title,body) values ($1,'wallet_deposit_approved','t','b')", [USER]);
  const { rows } = await db.query("select type from public.notifications where user_id=$1 and type in ('copy_closed','wallet_deposit_approved')", [USER]);
  assert.ok(!rows.some((r) => r.type === "copy_closed"));
  assert.ok(rows.some((r) => r.type === "wallet_deposit_approved"));
});
