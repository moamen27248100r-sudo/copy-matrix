// Email queue (0242) against SUPABASE_DB_URL: real-account notices are queued,
// demo trading isn't, per-category email switches are respected independently
// of the in-app ones, and security emails always go out. Rolled back at the
// end. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const DEMO = "00000000-0000-4000-8000-0000000000a1";
const REAL = "00000000-0000-4000-8000-0000000000a2";

async function as(user, fn) {
  await db.query("savepoint s");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: "authenticated" })]);
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}

const notify = (user, type) =>
  db.query("insert into public.notifications (user_id, type, title, body, data) values ($1, $2, $2, '', '{\"amount\": 10}')", [user, type]);
const queued = async (user) =>
  (await db.query("select kind, category, account_type from public.email_outbox where user_id = $1 order by id", [user])).rows;
const setPref = (user, category, inApp, email) =>
  db.query(
    "insert into public.notification_preferences (user_id, category, in_app, email) values ($1, $2, $3, $4) on conflict (user_id, category) do update set in_app = excluded.in_app, email = excluded.email",
    [user, category, inApp, email],
  );

before(async () => {
  await db.connect();
  await db.query("begin");
  for (const [id, email, locale] of [
    [DEMO, "mail-demo@example.test", "en"],
    [REAL, "mail-real@example.test", "fr"],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,$2,$3,'authenticated','authenticated')", [
      id,
      email,
      JSON.stringify({ account_type: "demo", locale }),
    ]);
  }
  await as(REAL, () => db.query("select switch_account_type('real')"));
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

test("the customer's language comes from sign-up", async () => {
  const { rows } = await db.query("select id, locale from public.profiles where id = any($1) order by id", [[DEMO, REAL]]);
  assert.deepEqual(rows.map((r) => r.locale), ["en", "fr"]);
});

test("real-account notices are queued, demo trading is not", async () => {
  await notify(REAL, "copy_closed");
  await notify(REAL, "wallet_deposit_approved");
  await notify(DEMO, "copy_closed");
  await notify(DEMO, "kyc_approved");
  assert.deepEqual(await queued(REAL), [
    { kind: "copy_closed", category: "copy", account_type: "real" },
    { kind: "wallet_deposit_approved", category: "account", account_type: "real" },
  ]);
  // Demo trading stays in the app; account notices are still emailed.
  assert.deepEqual(await queued(DEMO), [{ kind: "kyc_approved", category: "account", account_type: null }]);
});

test("followed-leader trade emails are off until switched on", async () => {
  await db.query("delete from public.email_outbox where user_id = $1", [REAL]);
  await notify(REAL, "followed_trade_opened");
  assert.equal((await queued(REAL)).length, 0);
  await setPref(REAL, "trades", true, true);
  await notify(REAL, "followed_trade_opened");
  assert.equal((await queued(REAL)).length, 1);
});

test("email and in-app switches are independent", async () => {
  await db.query("delete from public.email_outbox where user_id = $1", [REAL]);
  // In-app off, email on: no notification row, but the email is queued.
  await setPref(REAL, "copy", false, true);
  await notify(REAL, "copy_opened");
  const inApp = await db.query("select count(*)::int n from public.notifications where user_id = $1 and type = 'copy_opened'", [REAL]);
  assert.equal(inApp.rows[0].n, 0);
  assert.equal((await queued(REAL)).length, 1);
  // Email off: nothing queued.
  await setPref(REAL, "copy", true, false);
  await notify(REAL, "copy_opened");
  assert.equal((await queued(REAL)).length, 1);
});

test("security emails always go out", async () => {
  await db.query("delete from public.email_outbox where user_id = $1", [REAL]);
  for (const c of ["trades", "copy", "account"]) await setPref(REAL, c, false, false);
  await db.query(
    "insert into public.account_security_events (user_id, password_changed_at) values ($1, now()) on conflict (user_id) do update set password_changed_at = now()",
    [REAL],
  );
  await db.query("update public.account_security_events set mfa_changed_at = now() where user_id = $1", [REAL]);
  assert.deepEqual((await queued(REAL)).map((r) => r.kind), ["security_password_changed", "security_mfa_changed"]);
});
