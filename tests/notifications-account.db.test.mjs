// Notifications per account (0241) against SUPABASE_DB_URL: trading notices
// belong to the account they happened on, wallet notices to the real
// account, account / security notices to both; listing and "mark all read"
// only touch the current account. Rolled back at the end. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const USER = "00000000-0000-4000-8000-0000000000f1";

async function as(fn) {
  await db.query("savepoint s");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: USER, role: "authenticated" })]);
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}

const notify = (type) =>
  db.query("insert into public.notifications (user_id, type, title, body, data) values ($1, $2, $2, '', '{}') returning account_type", [USER, type]);
const mine = () => as(async () => (await db.query("select type, account_type, is_read from public.my_notifications(50)")).rows);

before(async () => {
  await db.connect();
  await db.query("begin");
  await db.query("insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,'notif@example.test',$2,'authenticated','authenticated')", [
    USER,
    JSON.stringify({ account_type: "demo" }),
  ]);
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

test("each notification is tagged with its account", async () => {
  assert.equal((await notify("copy_opened")).rows[0].account_type, "demo");
  assert.equal((await notify("followed_trade_closed")).rows[0].account_type, "demo");
  assert.equal((await notify("kyc_approved")).rows[0].account_type, null);
  assert.equal((await notify("wallet_deposit_approved")).rows[0].account_type, "real");
  await as(() => db.query("select switch_account_type('real')"));
  assert.equal((await notify("copy_closed")).rows[0].account_type, "real");
});

test("the list shows the current account's notifications and the shared ones", async () => {
  const real = await mine();
  assert.deepEqual(real.map((n) => n.type).sort(), ["copy_closed", "kyc_approved", "wallet_deposit_approved"]);
  await as(() => db.query("select switch_account_type('demo')"));
  const demo = await mine();
  assert.deepEqual(demo.map((n) => n.type).sort(), ["copy_opened", "followed_trade_closed", "kyc_approved"]);
});

test("mark all read only touches the current account", async () => {
  await as(() => db.query("select mark_my_notifications_read()"));
  const demo = await mine();
  assert.ok(demo.every((n) => n.is_read));
  await as(() => db.query("select switch_account_type('real')"));
  const real = await mine();
  assert.ok(real.find((n) => n.type === "copy_closed").is_read === false);
  assert.ok(real.find((n) => n.type === "wallet_deposit_approved").is_read === false);
});
