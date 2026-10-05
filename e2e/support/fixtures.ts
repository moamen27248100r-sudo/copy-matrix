// Temporary users + direct DB access for the client end-to-end scenario.
// Everything created here is tagged with RUN_TAG and removed by cleanup(); the
// scenario never touches any other account.
import { config } from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

export const RUN_TAG = `e2e${Date.now().toString(36)}`;
export const PASSWORD = "E2e-Pass-" + Math.random().toString(36).slice(2, 10) + "!9";
export const CLIENT_EMAIL = `${RUN_TAG}.client@example.com`;
export const LEADER_EMAIL = `${RUN_TAG}.leader@example.com`;

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let db: pg.Client | null = null;
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run<T>(text, params);
    } catch (e) {
      // the hosted pooler drops idle connections; reconnect once
      if (attempt >= 2 || !/terminated|ECONNRESET|closed/i.test(String(e))) throw e;
      db = null;
    }
  }
}
async function run<T>(text: string, params: unknown[]): Promise<T[]> {
  if (!db) {
    db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
    db.on("error", () => { db = null; });
    await db.connect();
  }
  return (await db.query(text, params)).rows as T[];
}
export async function closeDb() {
  await db?.end();
  db = null;
}

export type Fixture = { clientId: string; leaderUserId: string; providerId: string };

export async function createUser(email: string, name: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name, account_type: "demo" },
  });
  if (error || !data.user) throw new Error("createUser failed: " + error?.message);
  return data.user.id;
}

export async function createFixture(): Promise<Fixture> {
  const clientId = await createUser(CLIENT_EMAIL, "E2E Client");
  const leaderUserId = await createUser(LEADER_EMAIL, `E2E Leader ${RUN_TAG}`);
  const [{ id: providerId }] = await sql<{ id: string }>(
    `insert into public.providers (user_id, display_name, bio, min_copy_amount, skill, base_followers_count)
     values ($1, $2, 'E2E temporary leader', 100, 0.55, 0) returning id`,
    [leaderUserId, `E2E Leader ${RUN_TAG}`],
  );
  await admin.from("profiles").update({ is_lead_trader: true }).eq("id", leaderUserId);
  return { clientId, leaderUserId, providerId };
}

// Removes every row the scenario created. Order matters only for tables whose
// foreign keys do not cascade.
export async function cleanup(f: Partial<Fixture>) {
  const users = [f.clientId, f.leaderUserId].filter(Boolean) as string[];
  if (!users.length) return;
  const providers = f.providerId ? [f.providerId] : [];
  await sql(`delete from public.profit_share_ledger where follower_id = any($1) or provider_id = any($2)`, [users, providers]);
  await sql(`delete from public.lead_trader_follower_removals where follower_id = any($1) or provider_id = any($2)`, [users, providers]);
  await sql(`delete from public.lead_trader_announcements where provider_id = any($1)`, [providers]);
  await sql(`delete from public.lead_trader_payout_requests where user_id = any($1) or provider_id = any($2)`, [users, providers]);
  await sql(`delete from public.follower_invites where used_by = any($1) or provider_id = any($2)`, [users, providers]);
  await sql(`delete from public.lead_trader_applications where user_id = any($1) or provider_id = any($2)`, [users, providers]);
  await sql(`delete from public.lead_trader_profiles where provider_id = any($1)`, [providers]);
  await sql(`delete from public.admin_audit_log where admin_id = any($1)`, [users]);
  await sql(`delete from public.providers where id = any($1)`, [providers]);
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

export async function leftovers(): Promise<number> {
  const rows = await sql<{ n: string }>(
    `select count(*) n from auth.users where email like $1`,
    [`${RUN_TAG}.%`],
  );
  return Number(rows[0].n);
}

// ---- prices ---------------------------------------------------------------
export async function getPrice(symbol: string): Promise<number> {
  const [r] = await sql<{ price: string }>(`select price from public.market_prices where symbol = $1`, [symbol]);
  return Number(r.price);
}
// Sets the live price and returns the previous one. The 10-second price cron
// overwrites it anyway; tests restore it straight away.
export async function setPrice(symbol: string, price: number): Promise<number> {
  const prev = await getPrice(symbol);
  await sql(`update public.market_prices set price = $2, updated_at = now() where symbol = $1`, [symbol, price]);
  return prev;
}

// Local sign-ins share one rate-limit bucket ("login:unknown"); the scenario
// signs in several times per run, so its own bucket is emptied first. Real
// visitors' buckets (keyed by their address) are never touched.
export async function clearLocalRateLimits(userIds: string[] = []) {
  await sql(
    `delete from public.rate_limits
     where key in ('login:unknown', 'login:::1', 'login:127.0.0.1', 'signup:unknown')
        or key = any($1)
        -- the per-address buckets end with the address, e.g. "mfa-verify:<id>:::1"
        or key like any($2)`,
    [
      userIds.flatMap((id) => [`mfa-verify:${id}`, `mfa-verify-user:${id}`]),
      userIds.map((id) => `mfa-verify:${id}:%`),
    ],
  );
}

// Runs a sequence of price moves for one symbol inside a single transaction that
// holds the symbol's row lock, so the 10-second price feed cannot slip a tick in
// between the steps. The original price is restored before the commit.
export async function pricePath<T>(symbol: string, fn: () => Promise<T>): Promise<T> {
  await sql("begin");
  try {
    const [row] = await sql<{ price: string }>(`select price from public.market_prices where symbol = $1 for update`, [symbol]);
    const result = await fn();
    await sql(`update public.market_prices set price = $2, updated_at = now() where symbol = $1`, [symbol, row.price]);
    await sql("commit");
    return result;
  } catch (e) {
    await sql("rollback");
    throw e;
  }
}
