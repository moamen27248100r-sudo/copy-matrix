// Crypto wallet rules (0233) against SUPABASE_DB_URL: TxID deposits credited once, frozen
// withdrawals, 2FA, limits and the 24-hour lock after a password / 2FA change. Everything runs
// inside one transaction that is always rolled back, so nothing is left behind. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const USER = "00000000-0000-4000-8000-0000000000d1";
const ADMIN = "00000000-0000-4000-8000-0000000000d2";
const OUR_TRON = "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7";
const DEST_TRON = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const hash = (c) => c.repeat(64);

let claims = {};
const totpNow = () => ({ aal: "aal2", amr: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) }] });

async function as(uid, fn, extra = {}) {
  await db.query("savepoint s");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated", ...extra })]);
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}
const asUser = (fn) => as(USER, fn, claims);
const asAdmin = (fn) => as(ADMIN, fn, { aal: "aal2" });

async function fails(code, fn) {
  await db.query("savepoint f");
  await assert.rejects(fn, (e) => {
    if (e.code !== code) console.error("expected", code, "got", e.code, e.message);
    return e.code === code;
  });
  await db.query("rollback to f");
}

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const balance = async () => Number((await q("select balance from public.profiles where id=$1", [USER]))[0].balance);
const submit = async (h, network = "TRC20") => (await q("select * from public.crypto_deposit_submit($1,$2,$3)", [USER, network, h]))[0];
const check = async (id, result) => (await q("select * from public.crypto_deposit_record_check($1,$2)", [id, JSON.stringify(result)]))[0];
const withdraw = (amount, address = DEST_TRON, network = "TRC20") =>
  asUser(() => q("select public.request_crypto_withdrawal($1,$2,$3) id", [network, address, amount])).then((r) => r[0].id);
const wfails = (code, amount, address = DEST_TRON, network = "TRC20") =>
  asUser(() => fails(code, () => q("select public.request_crypto_withdrawal($1,$2,$3) id", [network, address, amount])));
const unlock = () => db.query("update public.account_security_events set password_changed_at = now() - interval '25 hours', mfa_changed_at = now() - interval '25 hours' where user_id=$1", [USER]);

before(async () => {
  await db.connect();
  await db.query("begin");
  for (const [id, email] of [[USER, "crypto-test@example.test"], [ADMIN, "crypto-admin@example.test"]]) {
    await db.query(
      "insert into auth.users (id,email,raw_user_meta_data,aud,role,encrypted_password) values ($1,$2,'{\"account_type\":\"real\"}','authenticated','authenticated','x')",
      [id, email],
    );
  }
  await db.query("update public.profiles set is_admin = true where id=$1", [ADMIN]);
  await db.query("update public.crypto_networks set deposit_address = $1, deposit_enabled = true, withdraw_enabled = true, min_deposit = 10, confirmations = 20, withdraw_fee = 1, min_withdraw = 10, daily_withdraw_limit = 1000 where id = 'TRC20'", [OUR_TRON]);
  await db.query("update public.crypto_networks set deposit_address = null where id = 'ERC20'");
  await db.query("update public.crypto_networks set deposit_address = '0x1111111111111111111111111111111111111111', deposit_enabled = true where id = 'BEP20'");
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

// Deposits ------------------------------------------------------------------------------------
test("customers cannot write deposits or run the server-side checks themselves", async () => {
  await asUser(() => fails("42501", () => q("insert into public.crypto_deposits(user_id,network,tx_hash,deposit_address,required_confirmations) values ($1,'TRC20',$2,'x',1)", [USER, hash("1")])));
  await asUser(() => fails("42501", () => q("select public.crypto_deposit_submit($1,'TRC20',$2)", [USER, hash("1")])));
  await asUser(() => fails("42501", () => q("select public.crypto_deposit_record_check(gen_random_uuid(),'{}')")));
});

test("valid deposit waits for confirmations (x/N), then credits the chain amount exactly once", async () => {
  const d = await submit("0x" + hash("A")); // 0x prefix and upper case are normalized
  assert.equal(d.tx_hash, hash("a"));
  assert.equal(d.deposit_address, OUR_TRON);
  assert.equal(d.required_confirmations, 20);

  let r = await check(d.id, { state: "found", amount: "125.5", confirmations: 7, from: "41ab", block: 100 });
  assert.equal(r.status, "pending");
  assert.equal(r.confirmations, 7);
  assert.equal(await balance(), 0);

  r = await check(d.id, { state: "found", amount: "125.5", confirmations: 20, from: "41ab", block: 100 });
  assert.equal(r.status, "completed");
  assert.equal(Number(r.amount), 125.5);
  assert.equal(await balance(), 125.5);

  // A repeated check (cron + page refresh racing) changes nothing.
  r = await check(d.id, { state: "found", amount: "125.5", confirmations: 25, from: "41ab", block: 100 });
  assert.equal(await balance(), 125.5);
  const ledger = await q("select amount from public.wallet_transactions where user_id=$1 and note=$2", [USER, `crypto_deposit:${d.id}`]);
  assert.equal(ledger.length, 1);
  const notes = await q("select data from public.notifications where user_id=$1 and type='wallet_deposit_approved'", [USER]);
  assert.equal(Number(notes[0].data.amount), 125.5);
});

test("a TxID can never be counted twice", async () => {
  await fails("CM032", () => submit(hash("a"))); // already completed
  const p = await submit(hash("b"));
  await fails("CM032", () => submit(hash("b"))); // still pending
  await fails("CM032", () => submit(hash("b"), "BEP20")); // same hash, other network
  await check(p.id, { state: "failed", reason: "wrong_recipient" });
  // after a failure the hash is free again (e.g. the customer picked the wrong network first)
  const again = await submit(hash("b"));
  assert.equal(again.status, "pending");
  await check(again.id, { state: "failed", reason: "wrong_recipient" });
});

test("wrong recipient / wrong token / failed tx / below minimum are refused with a reason", async () => {
  const before = await balance();
  for (const [c, result, reason] of [
    ["c", { state: "failed", reason: "wrong_recipient" }, "wrong_recipient"],
    ["d", { state: "failed", reason: "wrong_token" }, "wrong_token"],
    ["e", { state: "failed", reason: "tx_failed" }, "tx_failed"],
    ["f", { state: "found", amount: "9.99", confirmations: 30, block: 1 }, "below_minimum"],
  ]) {
    const d = await submit(hash(c));
    const r = await check(d.id, result);
    assert.equal(r.status, "failed");
    assert.equal(r.failure_reason, reason);
  }
  assert.equal(await balance(), before);
  const failed = await q("select data->>'reason' reason from public.notifications where user_id=$1 and type='wallet_deposit_failed'", [USER]);
  assert.ok(failed.some((n) => n.reason === "below_minimum"));
});

test("not found for an hour, or too many checks, ends the deposit; provider errors only retry", async () => {
  const d = await submit(hash("7"));
  let r = await check(d.id, { state: "error", message: "timeout" });
  assert.equal(r.status, "pending");
  assert.equal(r.check_attempts, 1);
  assert.ok(new Date(r.next_check_at) > new Date());
  r = await check(d.id, { state: "not_found" });
  assert.equal(r.status, "pending");
  await db.query("update public.crypto_deposits set created_at = now() - interval '61 minutes' where id=$1", [d.id]);
  r = await check(d.id, { state: "not_found" });
  assert.equal(r.failure_reason, "not_found");

  const e = await submit(hash("8"));
  await db.query("update public.crypto_deposits set check_attempts = 149 where id=$1", [e.id]);
  r = await check(e.id, { state: "found", amount: "50", confirmations: 3, block: 1 });
  assert.equal(r.failure_reason, "expired");
});

test("deposit guards: real account, network with an address, limits on pending submissions", async () => {
  await fails("CM030", () => submit(hash("9"), "ERC20")); // no address configured
  await db.query("update public.crypto_networks set deposit_enabled = false where id='TRC20'");
  await fails("CM030", () => submit(hash("9")));
  await db.query("update public.crypto_networks set deposit_enabled = true where id='TRC20'");
  await fails("CM031", () => submit("not-a-hash"));
  for (const c of ["0", "2", "3", "4", "5"]) await submit(hash(c));
  await fails("CM033", () => submit(hash("6")));
  await db.query("delete from public.crypto_deposits where user_id=$1 and status='pending'", [USER]);
  await asUser(() => q("select switch_account_type('demo')"));
  await fails("CM012", () => submit(hash("6")));
  await asUser(() => q("select switch_account_type('real')"));
});

// Withdrawals --------------------------------------------------------------------------------
test("withdrawals need 2FA enabled and a fresh code", async () => {
  await db.query("update public.profiles set balance = 1000 where id=$1", [USER]);
  await db.query("insert into public.kyc_submissions (user_id, full_name, national_id_number, id_document_path, status) values ($1,'T','0','t/none','approved')", [USER]);
  claims = totpNow();
  await wfails("CM040", 100); // no authenticator
  await db.query(
    "insert into auth.mfa_factors (id,user_id,friendly_name,factor_type,status,created_at,updated_at,secret) values (gen_random_uuid(),$1,'t','totp','verified',now(),now(),'s')",
    [USER],
  );
  await unlock();
  claims = { aal: "aal1" };
  await wfails("CM041", 100);
  claims = { aal: "aal2", amr: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) - 600 }] };
  await wfails("CM041", 100); // code older than 5 minutes
  claims = totpNow();
});

test("enabling / changing 2FA or the password locks withdrawals for 24 hours", async () => {
  await db.query("update auth.mfa_factors set status='unverified' where user_id=$1", [USER]);
  await db.query("update auth.mfa_factors set status='verified' where user_id=$1", [USER]);
  await wfails("CM042", 100);
  await unlock();
  await db.query("update auth.users set encrypted_password = 'changed' where id=$1", [USER]);
  const [ev] = await q("select password_changed_at > now() - interval '1 minute' fresh from public.account_security_events where user_id=$1", [USER]);
  assert.ok(ev.fresh);
  await wfails("CM042", 100);
  await unlock();
  // a factor being challenged (last_challenged_at) is not a settings change
  await db.query("update auth.mfa_factors set last_challenged_at = now() where user_id=$1", [USER]);
  const [still] = await q("select mfa_changed_at < now() - interval '24 hours' old from public.account_security_events where user_id=$1", [USER]);
  assert.ok(still.old);
});

test("address, minimum, balance and daily limit are enforced", async () => {
  await wfails("CM044", 100, "0x1111111111111111111111111111111111111111"); // EVM address on TRC20
  await wfails("CM044", 100, OUR_TRON); // our own deposit address
  await wfails("CM045", 9.99);
  await wfails("CM001", 10.0000001);
  await db.query("update public.crypto_networks set daily_withdraw_limit = 5000 where id='TRC20'");
  await wfails("CM006", 1000.01); // more than the balance
  await db.query("update public.crypto_networks set withdraw_enabled = false where id='TRC20'");
  await wfails("CM043", 100);
  await db.query("update public.crypto_networks set withdraw_enabled = true, daily_withdraw_limit = 300 where id='TRC20'");
  const id = await withdraw(200);
  await wfails("CM046", 150); // 200 + 150 > 300 within 24 hours
  await asUser(() => q("select public.cancel_crypto_withdrawal($1)", [id])); // cancelled ones free the limit
  const id2 = await withdraw(300);
  await asUser(() => q("select public.cancel_crypto_withdrawal($1)", [id2]));
  await db.query("update public.crypto_networks set daily_withdraw_limit = 1000 where id='TRC20'");
});

test("identity verification and open copied trades block withdrawals (0232 rules kept)", async () => {
  await db.query("update public.kyc_submissions set status = 'pending' where user_id=$1", [USER]);
  await wfails("CM024", 100);
  await db.query("update public.kyc_submissions set status = 'approved' where user_id=$1", [USER]);
  await db.query(
    "insert into public.simulated_positions (signal_id, follower_id, entry_price, size, status) values ((select id from public.signals limit 1), $1, 1, 10, 'open')",
    [USER],
  );
  await wfails("CM023", 100);
  await db.query("delete from public.simulated_positions where follower_id=$1", [USER]);
});

test("the amount is frozen at request and returned on cancel; no cancel once sending", async () => {
  assert.equal(await balance(), 1000);
  const id = await withdraw(250);
  assert.equal(await balance(), 750);
  const [w] = await q("select status, amount::float a, fee::float f, net_amount::float n from public.crypto_withdrawals where id=$1", [id]);
  assert.deepEqual(w, { status: "processing", a: 250, f: 1, n: 249 });
  await asUser(() => q("select public.cancel_crypto_withdrawal($1)", [id]));
  assert.equal(await balance(), 1000);
  await asUser(() => fails("CM047", () => q("select public.cancel_crypto_withdrawal($1)", [id])));
  const ledger = await q("select type, amount::float a from public.wallet_transactions where note=$1 order by created_at, type", [`crypto_withdrawal:${id}`]);
  assert.deepEqual(ledger.map((l) => l.a).sort(), [-250, 250]);

  // Once the back office starts sending, the customer can no longer cancel.
  const id2 = await withdraw(100);
  await asAdmin(() => q("select public.admin_crypto_withdrawal_start($1)", [id2]));
  await asUser(() => fails("CM047", () => q("select public.cancel_crypto_withdrawal($1)", [id2])));
  await asUser(() => fails("42501", () => q("select public.admin_crypto_withdrawal_complete($1,$2)", [id2, hash("e")])));
  await asAdmin(() => fails("CM031", () => q("select public.admin_crypto_withdrawal_complete($1,'abc')", [id2])));
  await asAdmin(() => q("select public.admin_crypto_withdrawal_complete($1,$2)", [id2, "0x" + hash("c")]));
  const [done] = await q("select status, tx_hash from public.crypto_withdrawals where id=$1", [id2]);
  assert.deepEqual(done, { status: "completed", tx_hash: hash("c") });
  assert.equal(await balance(), 900);
  await asAdmin(() => fails("CM048", () => q("select public.admin_crypto_withdrawal_reject($1,'x')", [id2])));

  // Rejected by the back office: the money comes back.
  const id3 = await withdraw(50);
  await asAdmin(() => q("select public.admin_crypto_withdrawal_start($1)", [id3]));
  await asAdmin(() => fails("CM032", () => q("select public.admin_crypto_withdrawal_complete($1,$2)", [id3, hash("c")]))); // TxID already used
  await asAdmin(() => q("select public.admin_crypto_withdrawal_reject($1,$2)", [id3, "Address flagged"]));
  assert.equal(await balance(), 900);
  const [rej] = await q("select status, reject_reason from public.crypto_withdrawals where id=$1", [id3]);
  assert.deepEqual(rej, { status: "rejected", reject_reason: "Address flagged" });
});

test("customers see only their own rows; settings change only through the admin function", async () => {
  const own = await asUser(() => q("select count(*)::int n from public.crypto_withdrawals"));
  const admin = await asAdmin(() => q("select count(*)::int n from public.crypto_withdrawals where user_id=$1", [USER]));
  assert.equal(own[0].n, admin[0].n);
  const others = await as(ADMIN, () => q("select count(*)::int n from public.crypto_deposits where user_id=$1", [USER]), { aal: "aal2" });
  assert.ok(others[0].n > 0); // admins can read
  await asUser(() => fails("42501", () => q("update public.crypto_networks set withdraw_fee = 0")));
  await asUser(() => fails("42501", () => q("select public.admin_update_crypto_network('TRC20',null,1,1,0,1,1,true,true)")));
  await asAdmin(() => fails("23514", () => q("select public.admin_update_crypto_network('TRC20','not-an-address',10,20,1,10,1000,true,true)")));
  await asAdmin(() => q("select public.admin_update_crypto_network('TRC20',$1,15,19,2,20,5000,true,true)", [OUR_TRON]));
  const [n] = await q("select min_deposit::float, confirmations, updated_by from public.crypto_networks where id='TRC20'");
  assert.deepEqual(n, { min_deposit: 15, confirmations: 19, updated_by: ADMIN });
});
