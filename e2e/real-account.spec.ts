// Real-account journey, driven through the UI like a customer: switch to the
// real account, get funded the way the admin panel does it, browse Discover,
// copy two leaders (a dedicated test leader and one of the platform's own
// simulated leaders), follow trades opening and closing -- including a trade
// opened by the live engine itself -- check wallet, history, notifications
// (with the Real badge), the email queue, stopping, and that the demo account
// stays separate. Runs against the live database with a temporary user and a
// temporary leader that are always removed afterwards.
// Run: npx playwright test e2e/real-account.spec.ts
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { CLIENT_EMAIL, PASSWORD, RUN_TAG, admin, clearLocalRateLimits, closeDb, createUser, getPrice, sql } from "./support/fixtures";

const BASE = "http://localhost:3000";
const strip = (s: string) => s.replace(/[⁦-⁩‎‏]/g, "");
const usdt = (n: number) => `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} USDT`;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

let clientId = "";
let testLeader = ""; // a temporary simulated leader (no persona: the engine leaves it alone)
let rosterLeader = ""; // one of the platform's 750 simulated leaders
let rosterMin = 0;
let ctx: BrowserContext;
let page: Page;
const FUNDING = 10000;

async function bodyText() {
  await page.waitForLoadState("networkidle");
  return strip(await page.locator("body").innerText());
}

async function profile() {
  const [p] = await sql<{ balance: string; other_balance: string; account_type: string }>(
    `select balance, other_balance, account_type from public.profiles where id = $1`,
    [clientId],
  );
  return { balance: Number(p.balance), other: Number(p.other_balance), type: p.account_type };
}

async function openCopyDialog(providerId: string) {
  await page.goto(`${BASE}/trader/${providerId}`);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog");
}

async function startCopy(providerId: string, amount: number) {
  const dlg = await openCopyDialog(providerId);
  await dlg.locator("input[name=allocatedAmount]").fill(String(amount));
  await page.getByLabel(/I understand that copy trading/).check();
  await dlg.getByRole("button", { name: "Start copying" }).click();
  await expect(page).toHaveURL(/success=started/);
}

const positions = (providerId: string) =>
  sql<{ id: string; status: string; size: string; entry_price: string; exit_price: string | null; pnl: string | null; account_type: string }>(
    `select sp.id, sp.status, sp.size, sp.entry_price, sp.exit_price, sp.pnl, sp.account_type
       from public.simulated_positions sp join public.signals g on g.id = sp.signal_id
      where sp.follower_id = $1 and g.provider_id = $2 order by sp.opened_at`,
    [clientId, providerId],
  );

test.describe.serial("Real account — full journey", () => {
  test.beforeAll(async ({ browser }) => {
    clientId = await createUser(CLIENT_EMAIL, "Real Tester");
    const [t] = await sql<{ id: string }>(
      `insert into public.providers (display_name, bio, min_copy_amount, trading_status, is_simulated, country)
       values ($1, 'E2E temporary leader', 100, 'active', true, 'US') returning id`,
      [`E2E Leader ${RUN_TAG}`],
    );
    testLeader = t.id;
    await sql(`select public.refresh_provider_stats(array[$1]::uuid[], true)`, [testLeader]);
    // A crypto leader (trades around the clock, weekends too) the customer can
    // afford and whose drawdown brake lets it trade right now (0246).
    const [r] = await sql<{ id: string; min: string }>(
      `select p.id, p.min_copy_amount min from public.providers p
        where p.is_simulated and (p.persona ->> 'weekend')::boolean and p.min_copy_amount <= 1000 and not p.is_archived
          and public.sim_drawdown_brake(p.id, p.persona, 0) > 0
          and (select count(*) from public.signals s where s.provider_id = p.id and s.status = 'open' and not s.hidden)
              < (p.persona ->> 'max_open')::int
        order by (p.persona ->> 'tpd')::numeric desc limit 1`,
    );
    rosterLeader = r.id;
    rosterMin = Number(r.min);
    ctx = await browser.newContext({ locale: "en", viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([{ name: "locale", value: "en", url: BASE }]);
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    await ctx?.close();
    // Everything the run created: the user (cascades to wallet, copies,
    // positions, notifications, emails) and the temporary leader with its trades.
    if (clientId) {
      await sql(`delete from public.email_outbox where user_id = $1`, [clientId]);
      await admin.auth.admin.deleteUser(clientId);
    }
    if (testLeader) await sql(`delete from public.providers where id = $1`, [testLeader]);
    const left = await sql<{ n: string }>(`select count(*) n from auth.users where email like $1`, [`${RUN_TAG}.%`]);
    expect(Number(left[0].n), "temporary user removed").toBe(0);
    await closeDb();
  });

  test("1. sign in, switch to the real account: the real wallet starts empty, demo is parked", async () => {
    await clearLocalRateLimits([clientId]);
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder(/email|البريد/i).fill(CLIENT_EMAIL);
    await page.locator("input[type=password]").first().fill(PASSWORD);
    await page.locator("button[type=submit]").first().click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("group").getByRole("button", { name: "Real", exact: true }).first().click();
    await page.getByRole("button", { name: "Switch", exact: true }).click();
    await expect.poll(async () => (await profile()).type).toBe("real");
    const p = await profile();
    expect(p.balance).toBe(0);
    expect(p.other).toBe(10000);
  });

  test("2. funded like the admin panel does it: the dashboard shows the real balance", async () => {
    // Same writes as adjustBalance in src/app/admin/actions.ts.
    await sql(`update public.profiles set balance = balance + $2 where id = $1`, [clientId, FUNDING]);
    await sql(
      `insert into public.wallet_transactions (user_id, type, amount, balance_after, note) values ($1, 'admin_adjustment', $2, $2, 'E2E funding')`,
      [clientId, FUNDING],
    );
    await page.goto(`${BASE}/dashboard`);
    const text = await bodyText();
    expect(text).toContain(usdt(FUNDING));
    expect(text).toContain("Real");
  });

  test("3. Discover lists every leader for the real account, with filters, sorting and pages", async () => {
    await page.goto(`${BASE}/discover`);
    let text = await bodyText();
    const total = Number(/(\d+) traders/.exec(text)?.[1] ?? 0);
    expect(total).toBeGreaterThanOrEqual(750);
    expect(text).toMatch(/1–24 of \d+/);
    await page.goto(`${BASE}/discover?style=scalper&risk=low&sort=roi`);
    text = await bodyText();
    const scalpers = Number(/(\d+) traders/.exec(text)?.[1] ?? 0);
    expect(scalpers).toBeGreaterThan(0);
    expect(scalpers).toBeLessThan(total);
    await page.goto(`${BASE}/discover?page=2&view=table`);
    text = await bodyText();
    expect(text).toMatch(/26–50 of \d+/);
  });

  test("4. a leader's profile shows the stats, chart and copy button", async () => {
    await page.goto(`${BASE}/trader/${rosterLeader}`);
    const text = await bodyText();
    for (const label of ["Copiers", "Total profit", "Overall win rate", "Max drawdown"]) expect(text).toContain(label);
    await expect(page.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
  });

  test("5. copy two leaders from the real account", async () => {
    await startCopy(testLeader, 2000);
    await startCopy(rosterLeader, Math.max(rosterMin, 1000));
    const subs = await sql<{ provider_id: string; allocated_amount: string; is_active: boolean }>(
      `select provider_id, allocated_amount, is_active from public.subscriptions where follower_id = $1 order by created_at`,
      [clientId],
    );
    expect(subs.map((s) => [s.provider_id, Number(s.allocated_amount), s.is_active])).toEqual([
      [testLeader, 2000, true],
      [rosterLeader, Math.max(rosterMin, 1000), true],
    ]);
    await page.goto(`${BASE}/copies`);
    const text = await bodyText();
    expect(text).toContain(`E2E Leader ${RUN_TAG}`);
  });

  let signalId = "";
  let entry = 0;
  test("6. the leader opens a trade: it is copied into the real account and announced", async () => {
    entry = await getPrice("BTCUSDT");
    const [s] = await sql<{ id: string }>(
      `insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at, lot_size)
       values ($1, 'BTCUSDT', 'buy', $2, 'open', now() - interval '10 minutes', 0.01) returning id`,
      [testLeader, entry],
    );
    signalId = s.id;
    const [pos] = await positions(testLeader);
    expect(pos.status).toBe("open");
    expect(pos.account_type).toBe("real");
    expect(Number(pos.size)).toBe(2000);
    const [n] = await sql<{ account_type: string }>(
      `select account_type from public.notifications where user_id = $1 and type = 'copy_opened' order by created_at desc limit 1`,
      [clientId],
    );
    expect(n.account_type).toBe("real");
    await page.goto(`${BASE}/trades`);
    expect(await bodyText()).toContain("BTCUSDT");
  });

  test("7. the leader closes it: the result lands in the real wallet to the cent, with history, notice and email", async () => {
    const before = (await profile()).balance;
    const exit = r2(entry * 1.01);
    await sql(`update public.signals set status = 'closed', exit_price = $2, closed_at = now() where id = $1`, [signalId, exit]);
    const [pos] = await positions(testLeader);
    expect(pos.status).toBe("closed");
    const expected = r2(((exit - entry) / entry) * 2000);
    expect(Number(pos.pnl)).toBeCloseTo(expected, 2);
    expect((await profile()).balance).toBeCloseTo(before + Number(pos.pnl), 2);
    const [tx] = await sql<{ account_type: string; amount: string }>(
      `select account_type, amount from public.wallet_transactions where user_id = $1 and type = 'pnl' order by created_at desc limit 1`,
      [clientId],
    );
    expect(tx.account_type).toBe("real");
    expect(Number(tx.amount)).toBeCloseTo(Number(pos.pnl), 2);
    const emails = await sql<{ kind: string; account_type: string }>(
      `select kind, account_type from public.email_outbox where user_id = $1 order by id`,
      [clientId],
    );
    expect(emails.map((e) => e.kind)).toEqual(expect.arrayContaining(["copy_opened", "copy_closed"]));
    expect(emails.every((e) => e.account_type === "real")).toBe(true);
    await page.goto(`${BASE}/notifications`);
    const text = await bodyText();
    expect(text).toContain("Real");
    expect(text).toContain("Trade closed");
  });

  test("8. the live engine opens a trade for a platform leader: it is copied too", async () => {
    // One genuine engine trade (same rules as the minute cron, without
    // waiting for its random timing). Market brakes can refuse; retry briefly.
    let opened = false;
    for (let i = 0; i < 20 && !opened; i++) {
      const [r] = await sql<{ ok: boolean }>(`select public.sim_open_trade($1) ok`, [rosterLeader]);
      opened = r.ok;
    }
    expect(opened, "the engine opened a trade").toBe(true);
    const copies = await positions(rosterLeader);
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.at(-1)!.account_type).toBe("real");
    expect(copies.at(-1)!.status).toBe("open");
  });

  test("9. following a leader works from the real account", async () => {
    await page.goto(`${BASE}/trader/${rosterLeader}`);
    await page.getByRole("button", { name: /^Follow$/ }).first().click();
    await expect.poll(async () => (await sql(`select 1 from public.follows where follower_id = $1 and provider_id = $2`, [clientId, rosterLeader])).length).toBe(1);
  });

  test("10. stopping both copies closes what is open and releases the money", async () => {
    await page.goto(`${BASE}/copies`);
    for (let i = 0; i < 2; i++) {
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Stop copying" }).first().click();
      await page.waitForLoadState("networkidle");
    }
    await expect(page.getByText("You are not copying anyone yet.")).toBeVisible();
    const open = await sql(`select 1 from public.simulated_positions where follower_id = $1 and status = 'open'`, [clientId]);
    expect(open).toHaveLength(0);
    const active = await sql(`select 1 from public.subscriptions where follower_id = $1 and is_active`, [clientId]);
    expect(active).toHaveLength(0);
  });

  test("11. back on demo: its wallet is untouched and the real account's notices stay with the real account", async () => {
    const realBalance = (await profile()).balance;
    await page.goto(`${BASE}/dashboard`);
    await page.getByRole("group").getByRole("button", { name: "Demo", exact: true }).first().click();
    await page.getByRole("button", { name: "Switch", exact: true }).click();
    await expect.poll(async () => (await profile()).type).toBe("demo");
    const p = await profile();
    expect(p.balance).toBe(10000);
    expect(p.other).toBeCloseTo(realBalance, 2);
    await page.goto(`${BASE}/notifications`);
    const text = await bodyText();
    expect(text).toContain("Demo");
    expect(text).not.toContain("Trade closed");
  });
});
