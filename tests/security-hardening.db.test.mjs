// Security audit regressions (migration 0245) against SUPABASE_DB_URL. Everything runs inside one
// transaction that is always rolled back. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const USER = "00000000-0000-4000-8000-0000000000d1";

async function as(role, fn) {
  await db.query("savepoint s");
  await db.query(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: USER, role })]);
  try {
    return await fn();
  } finally {
    await db.query("reset role");
  }
}

async function denied(code, fn) {
  await db.query("savepoint f");
  await assert.rejects(fn, (e) => e.code === code, `expected ${code}`);
  await db.query("rollback to f");
}

before(async () => {
  await db.connect();
  await db.query("begin");
  await db.query(
    "insert into auth.users (id,email,raw_user_meta_data,aud,role) values ($1,'sec-test@example.test','{\"account_type\":\"real\"}','authenticated','authenticated')",
    [USER],
  );
});

after(async () => {
  await db.query("rollback");
  await db.end();
});

const kycRow = (status) =>
  db.query("insert into public.kyc_submissions(user_id, full_name, national_id_number, id_document_path, status) values ($1,'T','1','p',$2)", [USER, status]);

test("a customer cannot insert an already-approved KYC submission", async () => {
  await as("authenticated", () => denied("42501", () => kycRow("approved")));
  await as("authenticated", () => denied("42501", () => kycRow("rejected")));
  await as("authenticated", () => kycRow("pending"));
  const { rows } = await db.query("select public.kyc_is_approved($1) ok", [USER]);
  assert.equal(rows[0].ok, false);
});

test("a customer cannot file a lead-trader application that is already approved or linked", async () => {
  const ins = (status, extra = "") =>
    db.query(`insert into public.lead_trader_applications(user_id, display_name, status ${extra ? "," + extra.split("=")[0] : ""}) values ($1,'T',$2 ${extra ? "," + extra.split("=")[1] : ""})`, [USER, status]);
  await as("authenticated", () => denied("42501", () => ins("approved")));
  await as("authenticated", () => denied("42501", () => ins("pending", "reviewed_at=now()")));
  await as("authenticated", () => ins("pending"));
});

const ENGINE = [
  "sim_close_trade(uuid,numeric,timestamptz,text)",
  "sim_open_trade(uuid)",
  "sim_advance_trade(uuid)",
  "provider_daily_apply(uuid,date,integer,integer,numeric,numeric,numeric,numeric,numeric,numeric)",
  "refresh_provider_stats(uuid[],boolean)",
  "refresh_dirty_provider_stats()",
  "run_daily_leader_maintenance()",
  "mark_provider_stats_dirty(uuid)",
  "refresh_sim_symbol_volatility()",
  "copy_check_leader_account(uuid,uuid)",
  "email_category_enabled(uuid,text)",
  "notification_account_type(text,uuid)",
  "check_rate_limit(text,integer,integer)",
];

test("engine functions are not executable by customers or anonymous visitors", async () => {
  for (const fn of ENGINE) {
    const { rows } = await db.query(
      "select has_function_privilege('authenticated', $1, 'execute') a, has_function_privilege('anon', $1, 'execute') n, has_function_privilege('service_role', $1, 'execute') s",
      [fn],
    );
    assert.deepEqual(rows[0], { a: false, n: false, s: true }, fn);
  }
  await as("authenticated", () => denied("42501", () => db.query("select public.sim_close_trade(gen_random_uuid(), 1, now(), 'tp')")));
  await as("anon", () => denied("42501", () => db.query("select public.check_rate_limit('login:victim', 1, 60)")));
});

test("no customer role can TRUNCATE or write engine-only tables", async () => {
  const { rows } = await db.query(
    `select table_name, privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated')
       and (privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
         or (table_name in ('rate_limits','platform_settings','provider_stats','provider_daily','provider_cash_flows','sim_symbols','sim_trade_plans','market_prices','price_history')
             and privilege_type in ('INSERT', 'UPDATE', 'DELETE')))`,
  );
  assert.deepEqual(rows, []);
});

test("starting a copy locks the customer's profile row (no double allocation across leaders)", async () => {
  const { rows } = await db.query("select pg_get_functiondef('public.start_or_update_copy(uuid,numeric,text,numeric,numeric,numeric,numeric,numeric,numeric,boolean)'::regprocedure) d");
  assert.match(rows[0].d, /from public\.profiles where id = auth\.uid\(\) for update/);
});
