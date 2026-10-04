// Full client journey, driven through the real UI like a trader would, with
// every number re-derived independently from the database / plain arithmetic.
// Runs against the live database with temporary users that are always removed
// afterwards. Run: npm run test:e2e:client
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  CLIENT_EMAIL,
  LEADER_EMAIL,
  PASSWORD,
  RUN_TAG,
  cleanup,
  clearLocalRateLimits,
  closeDb,
  createFixture,
  getPrice,
  leftovers,
  pricePath,
  setPrice,
  sql,
  type Fixture,
} from "./support/fixtures";
import { freshWindow, totp } from "./support/totp";

const BASE = "http://localhost:3000";
const strip = (s: string) => s.replace(/[⁦-⁩‎‏]/g, "");
const usdt = (n: number) => `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} USDT`;
const fmt2 = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

let fx: Fixture;
let clientCtx: BrowserContext;
let leaderCtx: BrowserContext;
let client: Page;
let leader: Page;
let realWallet = 0; // the parked real wallet when the trading chapters start

async function newCtx(browser: Browser, locale: "en" | "ar") {
  const ctx = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  return ctx;
}

async function login(page: Page, email: string) {
  await clearLocalRateLimits([fx?.clientId, fx?.leaderUserId].filter(Boolean) as string[]);
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder(/email|البريد/i).fill(email);
  await page.locator("input[type=password]").first().fill(PASSWORD);
  await page.locator("button[type=submit]").first().click();
}

async function bodyText(page: Page) {
  await page.waitForLoadState("networkidle");
  return strip(await page.locator("body").innerText());
}

async function profile() {
  const [p] = await sql<{ balance: string; other_balance: string; account_type: string; account_number: string; display_name: string }>(
    `select balance, other_balance, account_type, account_number, display_name from public.profiles where id = $1`,
    [fx.clientId],
  );
  return { balance: Number(p.balance), other: Number(p.other_balance), type: p.account_type, number: p.account_number, name: p.display_name };
}

test.describe.serial("Client dashboard — full journey", () => {
  // E2E_FROM=copy skips the account + wallet chapters (they are independent of the rest) while developing.
  const early = process.env.E2E_FROM === "copy" ? test.skip : test;

  test.beforeAll(async ({ browser }) => {
    fx = await createFixture();
    clientCtx = await newCtx(browser, "en");
    leaderCtx = await newCtx(browser, "en");
    client = await clientCtx.newPage();
    leader = await leaderCtx.newPage();
  });

  test.afterAll(async () => {
    await clientCtx?.close();
    await leaderCtx?.close();
    await cleanup(fx ?? {});
    expect(await leftovers(), "temporary users must be fully removed").toBe(0);
    await closeDb();
  });

  // ---------------------------------------------------------------- 1. account
  early("1. new account starts on demo with 10,000 USDT and an account number", async () => {
    await login(client, CLIENT_EMAIL);
    await expect(client).toHaveURL(/\/dashboard/);
    const p = await profile();
    expect(p.type).toBe("demo");
    expect(p.balance).toBe(10000);
    expect(p.other).toBe(0);
    expect(p.number).toMatch(/^\d{8}$/);
    const text = await bodyText(client);
    expect(text).toContain(usdt(10000));
    expect(text).toContain(`#${p.number}`);
    expect(text).toContain("Demo");
  });

  early("1b. profile name can be changed in settings", async () => {
    await client.goto(`${BASE}/settings`);
    await client.locator("input[name=displayName]").fill("Test Trader");
    await client.getByRole("button", { name: "Save name" }).click();
    await expect(client).toHaveURL(/success=1/);
    expect((await profile()).name).toBe("Test Trader");
    await client.locator("input[name=displayName]").fill("");
    await client.getByRole("button", { name: "Save name" }).click(); // browser validation blocks empty
    expect((await profile()).name).toBe("Test Trader");
  });
  early("1c. switching to the real account and back keeps the two wallets separate", async () => {
    await client.goto(`${BASE}/dashboard`);
    await client.getByRole("group").getByRole("button", { name: "Real", exact: true }).first().click();
    await expect(client.getByText(/kept separate/i)).toBeVisible();
    await client.getByRole("button", { name: "Switch", exact: true }).click();
    await expect(client).toHaveURL(/dashboard/);
    await expect.poll(async () => (await profile()).type).toBe("real");
    let p = await profile();
    expect(p.balance).toBe(0); // the real wallet is empty
    expect(p.other).toBe(10000); // the demo wallet is parked, untouched
    expect(await bodyText(client)).not.toContain(usdt(10000));
    // and back
    await client.getByRole("group").getByRole("button", { name: "Demo", exact: true }).first().click();
    await client.getByRole("button", { name: "Switch", exact: true }).click();
    await expect.poll(async () => (await profile()).type).toBe("demo");
    p = await profile();
    expect(p.balance).toBe(10000);
    expect(p.other).toBe(0);
  });

  // ---------------------------------------------------------------- 1d-1g. language, sessions, 2FA, logout
  early("1d. language switches to Arabic (RTL) and back to English", async () => {
    await client.goto(`${BASE}/settings`);
    await client.getByRole("button", { name: "Language" }).first().click();
    await client.getByRole("button", { name: "العربية" }).click();
    await expect(client.locator("html")).toHaveAttribute("dir", "rtl");
    await client.goto(`${BASE}/dashboard`);
    await expect(client.getByText("نقدي متاح للسحب").first()).toBeVisible();
    await client.goto(`${BASE}/settings`);
    await client.getByRole("button", { name: "اللغة" }).first().click();
    await client.getByRole("button", { name: "English" }).click();
    await expect(client.locator("html")).toHaveAttribute("dir", "ltr");
    await client.goto(`${BASE}/dashboard`);
    await expect(client.getByText("Available cash to withdraw").first()).toBeVisible();
  });

  early("1e. sessions list shows each real device and can sign out the others", async () => {
    const other = await (await newCtx(client.context().browser()!, "en")).newPage();
    await login(other, CLIENT_EMAIL);
    await expect(other).toHaveURL(/dashboard/);
    await client.goto(`${BASE}/account/sessions`);
    const text = await bodyText(client);
    expect(text).not.toContain("Unknown device");
    expect(text).toContain("This device");
    expect((await client.locator("main ul li").count())).toBeGreaterThanOrEqual(2);
    await client.getByRole("button", { name: /sign out.*other|other devices/i }).click();
    await expect(client).toHaveURL(/done=1/);
    await expect(client.getByText(/No other devices/i)).toBeVisible();
    await other.goto(`${BASE}/dashboard`);
    await expect(other).toHaveURL(/login/); // the other device was signed out
    await other.context().close();
  });

  early("1f. two-factor sign-in: enrol, wrong code rejected, right code accepted, then disable", async () => {
    await client.goto(`${BASE}/account/security`);
    await client.getByRole("button", { name: "Enable two-factor authentication" }).click();
    const secret = (await client.locator("code").first().innerText()).replace(/\s/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    await freshWindow();
    await client.locator("#mfa-enroll-code").fill(totp(secret));
    await client.getByRole("button", { name: "Confirm and enable" }).click();
    await expect(client.getByText("Two-factor authentication is now on.")).toBeVisible();
    await expect(client.getByText("Enabled", { exact: true })).toBeVisible();

    // fresh browser: password alone is not enough
    const ctx2 = await newCtx(client.context().browser()!, "en");
    const p2 = await ctx2.newPage();
    await login(p2, CLIENT_EMAIL);
    await expect(p2).toHaveURL(/\/login\/mfa/);
    await p2.goto(`${BASE}/dashboard`);
    await expect(p2).toHaveURL(/\/login\/mfa/); // cannot skip the challenge
    await p2.locator("#mfa-code").fill("000000");
    await p2.getByRole("button", { name: "Verify" }).click();
    await expect(p2.getByRole("alert")).toBeVisible();
    expect(strip(await p2.getByRole("alert").innerText())).not.toMatch(/mfa_|AuthApiError|undefined|null/);
    await freshWindow();
    await p2.locator("#mfa-code").fill(totp(secret));
    await p2.getByRole("button", { name: "Verify" }).click();
    await expect(p2).toHaveURL(/dashboard/);
    await ctx2.close();

    // turn it off again so the rest of the journey signs in normally
    await client.goto(`${BASE}/account/security`);
    await client.getByRole("button", { name: "Disable two-factor authentication" }).click();
    await freshWindow();
    await client.locator("input[name=code]").fill(totp(secret));
    await client.getByRole("button", { name: "Confirm and disable" }).click();
    await expect(client.getByText("Two-factor authentication has been turned off.")).toBeVisible();
  });

  // ---------------------------------------------------------------- 2. wallet (demo)
  early("2a. demo deposit is instant and exact", async () => {
    await client.goto(`${BASE}/portfolio/deposit`);
    const submit = client.getByRole("button", { name: "Deposit" });
    await expect(submit).toBeDisabled(); // empty amount
    await client.locator("input[name=amount]").fill("2500.50");
    await submit.click();
    await expect(client).toHaveURL(/demo=deposit/);
    expect(await bodyText(client)).toContain("Demo funds added to your balance.");
    expect((await profile()).balance).toBe(12500.5);
    const tx = await sql<{ type: string; amount: string; balance_after: string; account_type: string }>(
      `select type, amount, balance_after, account_type from public.wallet_transactions where user_id = $1 order by created_at desc limit 1`, [fx.clientId]);
    expect(tx[0].type).toBe("deposit");
    expect(Number(tx[0].amount)).toBe(2500.5);
    expect(Number(tx[0].balance_after)).toBe(12500.5);
    expect(tx[0].account_type).toBe("demo");
    expect(await bodyText(client)).toContain(usdt(12500.5));
  });

  early("2b. demo deposit above the demo cap is refused with a clear message", async () => {
    await client.goto(`${BASE}/portfolio/deposit`);
    await client.locator("input[name=amount]").fill("999999");
    await client.getByRole("button", { name: "Deposit" }).click();
    await expect(client).toHaveURL(/error=/);
    expect(await bodyText(client)).toContain("maximum demo balance of 1,000,000 USDT");
    expect((await profile()).balance).toBe(12500.5);
  });

  early("2c. demo withdrawal is instant; more than available is blocked", async () => {
    await client.goto(`${BASE}/portfolio/withdraw`);
    const confirm = client.getByRole("button", { name: "Confirm withdrawal" });
    const input = client.locator("main input[type=text]");
    await input.fill("99999999");
    await expect(confirm).toBeDisabled();
    await input.fill("500.25");
    await confirm.click();
    await expect(client).toHaveURL(/demo=withdraw/);
    expect(await bodyText(client)).toContain("Demo funds withdrawn from your balance.");
    expect((await profile()).balance).toBe(12000.25);
    const tx = await sql<{ type: string; amount: string }>(
      `select type, amount from public.wallet_transactions where user_id = $1 order by created_at desc limit 1`, [fx.clientId]);
    expect(tx[0].type).toBe("withdrawal");
    expect(Number(tx[0].amount)).toBe(-500.25);
  });

  early("2d. a double click on deposit credits only once", async () => {
    await client.goto(`${BASE}/portfolio/deposit`);
    await client.locator("input[name=amount]").fill("100");
    await client.getByRole("button", { name: "Deposit" }).dblclick();
    await client.waitForURL(/demo=deposit/);
    await client.waitForTimeout(1500);
    expect((await profile()).balance).toBe(12100.25);
  });

  early("2e. reset returns the demo wallet to exactly 10,000 USDT", async () => {
    await client.goto(`${BASE}/portfolio`);
    client.once("dialog", (d) => d.accept());
    await client.getByRole("button", { name: "Reset demo balance" }).click();
    await expect(client).toHaveURL(/demo=reset/);
    expect(await bodyText(client)).toContain("Your demo balance was reset to 10,000 USDT.");
    expect((await profile()).balance).toBe(10000);
  });
  // ---------------------------------------------------------------- 2. wallet (real)
  early("2f. real deposit: request is pending, wallet only moves when completed", async () => {
    await client.goto(`${BASE}/dashboard`);
    await client.getByRole("group").getByRole("button", { name: "Real", exact: true }).first().click();
    await client.getByRole("button", { name: "Switch", exact: true }).click();
    await expect.poll(async () => (await profile()).type).toBe("real");
    await client.goto(`${BASE}/portfolio/deposit`);
    await client.getByRole("button", { name: /USDT/ }).first().click();
    await client.getByRole("button", { name: /TRC20/ }).click();
    await client.locator("input[name=amount]").fill("250");
    await client.getByRole("button", { name: /Confirm|submit|sent/i }).last().click();
    await expect(client).toHaveURL(/success=1/);
    const rows = await sql<{ type: string; amount: string; status: string; account_type: string }>(
      `select type, amount, status, account_type from public.wallet_requests where user_id = $1`, [fx.clientId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "deposit", status: "pending", account_type: "real" });
    expect(Number(rows[0].amount)).toBe(250);
    expect((await profile()).balance).toBe(0); // not credited until completed
    await client.goto(`${BASE}/portfolio?tab=activity`);
    const activity = await bodyText(client);
    expect(activity).toContain("250.00 USDT");
    expect(activity).toContain("Processing");
  });

  early("2g. completing the deposit credits only the real wallet and notifies", async () => {
    // What the back office does when it approves the request.
    await sql(`update public.wallet_requests set status = 'approved' where user_id = $1 and type = 'deposit'`, [fx.clientId]);
    const p = await profile();
    expect(p.balance).toBe(250);
    expect(p.other).toBe(10000); // demo wallet untouched
    const tx = await sql<{ type: string; amount: string; balance_after: string; account_type: string }>(
      `select type, amount, balance_after, account_type from public.wallet_transactions where user_id = $1 and account_type = 'real'`, [fx.clientId]);
    expect(tx).toHaveLength(1);
    expect(Number(tx[0].amount)).toBe(250);
    expect(Number(tx[0].balance_after)).toBe(250);
    await client.goto(`${BASE}/notifications`);
    const text = await bodyText(client);
    expect(text).toContain("Deposit completed");
    expect(text).toContain("Your transaction of 250.00 USDT has been completed.");
    await client.goto(`${BASE}/portfolio?tab=activity`);
    const act = await bodyText(client);
    expect(act).toContain("Completed");
    expect(act).toContain(usdt(250));
  });

  const TRC20_ADDRESS = "TXpN7mK4hLqR2vZ8wD3fS6cY1uB5eJ9gAx";
  async function startWithdrawal(amount: string, address: string) {
    await client.goto(`${BASE}/portfolio/withdraw`);
    await client.locator("main input[type=text]").first().fill(amount);
    await client.getByRole("button", { name: "Continue" }).click();
    await client.getByRole("button", { name: /USDT/ }).first().click();
    await client.getByRole("button", { name: /TRC20/ }).click();
    await client.getByPlaceholder("Enter your wallet address on the selected network").fill(address);
    await client.getByRole("button", { name: "Confirm withdrawal" }).click();
    await client.getByRole("checkbox").check();
    await client.getByRole("button", { name: "Confirm and send" }).click();
  }

  early("2h. withdrawal with an invalid wallet address is refused with a clear message", async () => {
    await startWithdrawal("100", "abc");
    await expect(client).toHaveURL(/error=/);
    expect(await bodyText(client)).toContain("wallet address");
    const n = await sql(`select 1 from public.wallet_requests where user_id = $1 and type = 'withdrawal'`, [fx.clientId]);
    expect(n).toHaveLength(0);
  });

  early("2i. real withdrawal is a pending request; the wallet moves only when completed", async () => {
    await startWithdrawal("100", TRC20_ADDRESS);
    await expect(client).toHaveURL(/success=1/);
    const rows = await sql<{ amount: string; status: string; note: string }>(
      `select amount, status, note from public.wallet_requests where user_id = $1 and type = 'withdrawal'`, [fx.clientId]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amount)).toBe(100);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].note).toContain(TRC20_ADDRESS);
    expect((await profile()).balance).toBe(250);
    await sql(`update public.wallet_requests set status = 'approved' where user_id = $1 and type = 'withdrawal'`, [fx.clientId]);
    const p = await profile();
    expect(p.balance).toBe(150);
    expect(p.other).toBe(10000);
    await client.goto(`${BASE}/notifications`);
    const text = await bodyText(client);
    expect(text).toContain("Withdrawal completed");
    expect(text).toContain("Your transaction of 100.00 USDT has been completed.");
  });

  early("2j. a rejected deposit leaves the wallet alone and says so politely", async () => {
    await client.goto(`${BASE}/portfolio/deposit`);
    await client.getByRole("button", { name: /USDT/ }).first().click();
    await client.getByRole("button", { name: /TRC20/ }).click();
    await client.locator("input[name=amount]").fill("75");
    await client.getByRole("button", { name: "Confirm" }).last().click();
    await expect(client).toHaveURL(/success=1/);
    await sql(`update public.wallet_requests set status = 'rejected' where user_id = $1 and type = 'deposit' and amount = 75`, [fx.clientId]);
    expect((await profile()).balance).toBe(150);
    await client.goto(`${BASE}/notifications`);
    const text = await bodyText(client);
    expect(text).toContain("Deposit rejected");
    expect(text).toContain("Your request could not be completed. Please contact support for details.");
  });

  early("2k. withdrawing more than the real balance is blocked", async () => {
    await client.goto(`${BASE}/portfolio/withdraw`);
    await client.locator("main input[type=text]").first().fill("150.01");
    await expect(client.getByRole("button", { name: "Continue" })).toBeDisabled();
    await client.locator("main input[type=text]").first().fill("150");
    await expect(client.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
  // ---------------------------------------------------------------- 3. copy: discover, start, settings
  test("3a. the leader signs in; Discover lists traders and a profile opens", async () => {
    await login(leader, LEADER_EMAIL);
    await expect(leader).toHaveURL(/dashboard/);
    if (client.url() === "about:blank") {
      await login(client, CLIENT_EMAIL);
      await expect(client).toHaveURL(/dashboard/);
    }
    await client.goto(`${BASE}/dashboard`);
    // back to the demo account for the trading journey
    if ((await profile()).type !== "demo") {
      await client.getByRole("group").getByRole("button", { name: "Demo", exact: true }).first().click();
      await client.getByRole("button", { name: "Switch", exact: true }).click();
      await expect.poll(async () => (await profile()).type).toBe("demo");
    }
    expect((await profile()).balance).toBe(10000);
    realWallet = (await profile()).other;
    // Discover lists traders with their key stats and a way into each profile
    await client.goto(`${BASE}/discover`);
    await expect(client.getByRole("heading", { name: "Discover traders" })).toBeVisible();
    const cards = client.getByRole("link", { name: "View profile" });
    expect(await cards.count()).toBeGreaterThan(3);
    const cardText = await bodyText(client);
    expect(cardText).toMatch(/Win rate/);
    expect(cardText).toMatch(/Minimum copy: \d[\d,]*\.\d{2} USDT/);
    await cards.first().click();
    await expect(client).toHaveURL(/\/trader\//);
    // a brand-new self-service leader is not listed until eligible, but the profile opens
    await client.goto(`${BASE}/trader/${fx.providerId}`);
    expect(await bodyText(client)).toContain("Minimum copy amount for this trader: 100.00 USDT");
  });

  async function openCopyDialog() {
    await client.goto(`${BASE}/trader/${fx.providerId}`);
    await client.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(client.getByRole("dialog")).toBeVisible();
  }

  test("3b. invalid copy amounts are rejected with a clear message", async () => {
    await openCopyDialog();
    const dlg = client.getByRole("dialog");
    await client.getByLabel(/I understand that copy trading/).check();
    // below the trader's minimum (bypassing the browser's own min check)
    await client.locator("form:has(input[name=allocatedAmount])").evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await dlg.locator("input[name=allocatedAmount]").fill("50");
    await dlg.getByRole("button", { name: "Start copying" }).click();
    await expect(client).toHaveURL(/error=/);
    expect(await bodyText(client)).toContain("below the minimum for this trader (100.00 USDT)");
    // more than the available balance
    await openCopyDialog();
    await client.getByLabel(/I understand that copy trading/).check();
    await dlg.locator("input[name=allocatedAmount]").fill("10000.01");
    await client.locator("form:has(input[name=allocatedAmount])").evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await dlg.getByRole("button", { name: "Start copying" }).click();
    await expect(client).toHaveURL(/error=/);
    expect(await bodyText(client)).toContain("The copy amount is greater than your available balance.");
    // out-of-range take profit / stop loss / trailing, and a non-positive amount
    const cases: [string, string, string][] = [
      ["takeProfitPct", "0.5", "Take profit must be between 1% and 500% of the margin."],
      ["tradeStopLossPct", "95", "Stop loss must be between 1% and 90% of the margin."],
      ["trailingPct", "0.1", "Trailing stop must be between 0.5% and 50%."],
    ];
    for (const [field, value, message] of cases) {
      await openCopyDialog();
      await client.getByRole("button", { name: /Advanced settings/ }).click();
      await client.getByLabel(/I understand that copy trading/).check();
      await dlg.locator("input[name=allocatedAmount]").fill("1000");
      await dlg.locator(`input[name=${field}]`).fill(value);
      await client.locator("form:has(input[name=allocatedAmount])").evaluate((f: HTMLFormElement) => (f.noValidate = true));
      await dlg.getByRole("button", { name: "Start copying" }).click();
      await expect(client).toHaveURL(/error=/);
      expect(await bodyText(client)).toContain(message);
    }
    const subs = await sql(`select 1 from public.subscriptions where follower_id = $1`, [fx.clientId]);
    expect(subs).toHaveLength(0);
  });

  test("3c. copy starts with every setting stored exactly as entered; a double click makes one copy", async () => {
    await openCopyDialog();
    const dlg = client.getByRole("dialog");
    await dlg.locator("input[name=allocatedAmount]").fill("4000");
    await dlg.getByLabel("Fixed amount per trade").check();
    await dlg.locator("input[name=fixedAmount]").fill("1000");
    await client.getByRole("button", { name: /Advanced settings/ }).click();
    await dlg.locator("input[name=maxPerTrade]").fill("800");
    await dlg.locator("input[name=takeProfitPct]").fill("5");
    await dlg.locator("input[name=tradeStopLossPct]").fill("3");
    const start = dlg.getByRole("button", { name: "Start copying" });
    await expect(start).toBeDisabled(); // risk acknowledgement required
    await client.getByLabel(/I understand that copy trading/).check();
    await start.dblclick();
    await expect(client).toHaveURL(/success=started/);
    expect(await bodyText(client)).toContain("4,000.00 USDT");
    const subs = await sql<Record<string, string | null>>(
      `select allocated_amount, copy_mode, fixed_amount, max_per_trade, max_drawdown_pct, tp_pct, sl_pct, trailing_pct, is_active
       from public.subscriptions where follower_id = $1`, [fx.clientId]);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ copy_mode: "fixed", is_active: true });
    expect(Number(subs[0].allocated_amount)).toBe(4000);
    expect(Number(subs[0].fixed_amount)).toBe(1000);
    expect(Number(subs[0].max_per_trade)).toBe(800);
    expect(Number(subs[0].max_drawdown_pct)).toBe(50);
    expect(Number(subs[0].tp_pct)).toBe(5);
    expect(Number(subs[0].sl_pct)).toBe(3);
    expect(subs[0].trailing_pct).toBeNull();
    // the allocation is held back from what can be withdrawn
    await client.goto(`${BASE}/portfolio`);
    const text = await bodyText(client);
    expect(text).toContain("Reserved for active copying");
    expect(text).toContain(usdt(4000));
    expect((await profile()).balance).toBe(10000);
  });

  test("3d. copying the same trader again keeps a single active copy", async () => {
    // a stale second tab still showing the "Copy" dialog
    await client.goto(`${BASE}/trader/${fx.providerId}`);
    expect(await bodyText(client)).toContain("Stop copying");
    expect(await client.getByRole("button", { name: "Copy", exact: true }).count()).toBe(0);
    const res = await sql(`select count(*) n from public.subscriptions where follower_id = $1 and provider_id = $2 and is_active`, [fx.clientId, fx.providerId]);
    expect(Number(res[0].n)).toBe(1);
  });
  // ---------------------------------------------------------------- 4. trades
  type Pos = { id: string; status: string; size: string; entry_price: string; exit_price: string | null; pnl: string | null; take_profit: string | null; stop_loss: string | null; trail_pct: string | null; best_price: string | null; side: string; symbol: string; sig_entry: string; signal_id: string };
  async function positions(): Promise<Pos[]> {
    return sql<Pos>(
      `select sp.id, sp.status, sp.size, sp.entry_price, sp.exit_price, sp.pnl, sp.take_profit, sp.stop_loss, sp.trail_pct, sp.best_price,
              s.side, s.symbol, s.entry_price as sig_entry, s.id as signal_id
       from public.simulated_positions sp join public.signals s on s.id = sp.signal_id
       where sp.follower_id = $1 order by sp.opened_at, sp.id`, [fx.clientId]);
  }
  const signalCount = async () => Number((await sql(`select count(*) n from public.signals where provider_id = $1`, [fx.providerId]))[0].n);
  async function leaderOpen(symbol: string, side: "buy" | "sell", size = "1") {
    const before = await signalCount();
    await leader.goto(`${BASE}/lead/trades`);
    await leader.locator("select[name=symbol]").selectOption(symbol);
    await leader.locator("select[name=side]").selectOption(side);
    await leader.locator("input[name=size]").fill(size);
    await leader.getByRole("button", { name: "Place order" }).click();
    await expect.poll(signalCount).toBe(before + 1);
  }
  const pnlOf = (side: string, entry: number, exit: number, size: number) =>
    r2(((exit - entry) / entry) * size * (side === "sell" ? -1 : 1));
  async function lastNotification(type: string) {
    const rows = await sql<{ title: string; body: string; data: Record<string, unknown> }>(
      `select title, body, data from public.notifications where user_id = $1 and type = $2 order by created_at desc limit 1`, [fx.clientId, type]);
    return rows[0];
  }

  test("4a. leader opens a BUY: it is copied with the exact size, entry, take-profit and stop-loss", async () => {
    await leaderOpen("BTCUSDT", "buy");
    await expect.poll(async () => (await positions()).length).toBe(1);
    const [p] = await positions();
    expect(p.status).toBe("open");
    expect(Number(p.size)).toBe(800); // min(fixed 1000, max-per-trade 800, allocation left 4000)
    expect(Number(p.entry_price)).toBe(Number(p.sig_entry));
    const entry = Number(p.entry_price);
    expect(Number(p.take_profit)).toBeCloseTo(entry * 1.05, 6);
    expect(Number(p.stop_loss)).toBeCloseTo(entry * 0.97, 6);
    expect(p.trail_pct).toBeNull();
    await client.goto(`${BASE}/trades`);
    const text = await bodyText(client);
    expect(text).toContain("BTCUSDT");
    expect(text).toContain("BUY");
    expect(text).toMatch(/TP [\d,.]+/);
    expect(text).toMatch(/SL [\d,.]+/);
  });

  test("4b. live profit/loss on the open trade matches size x price move", async () => {
    const [p] = await positions();
    const entry = Number(p.entry_price);
    const target = Math.round(entry * 1.01 * 100) / 100;
    const prev = await setPrice("BTCUSDT", target);
    try {
      await client.goto(`${BASE}/trades`);
      const text = await bodyText(client);
      // The page shows the pnl, the percentage and the price it used (the 10 s price feed may
      // have moved it already); each must agree with the others and with size x move.
      const m = /([+-][\d,]+\.\d{2}) USDT\s*([+-]\d+\.\d{2})%\s*·\s*([\d,]+(?:\.\d+)?)/.exec(text);
      expect(m, "open position row").not.toBeNull();
      const shownPnl = Number(m![1].replace(/,/g, ""));
      const shownPct = Number(m![2]);
      const shown = Number(m![3].replace(/,/g, ""));
      expect(Math.abs(shownPnl - ((shown - entry) / entry) * 800)).toBeLessThan(0.05);
      expect(Math.abs(shownPct - ((shown - entry) / entry) * 100)).toBeLessThan(0.01);
    } finally {
      await setPrice("BTCUSDT", prev);
    }
  });

  test("4c. take-profit closes the copy at the live price and credits the exact profit", async () => {
    const [p] = await positions();
    const entry = Number(p.entry_price);
    const walletBefore = await profile();
    const before = walletBefore.balance;
    const exit = Math.round(Number(p.take_profit) * 1.002 * 100) / 100; // price gaps through the target
    await pricePath("BTCUSDT", () => setPrice("BTCUSDT", exit));
    const [c] = await positions();
    expect(c.status).toBe("closed");
    expect(Number(c.exit_price)).toBe(exit);
    const expected = pnlOf("buy", entry, exit, 800);
    expect(expected).toBeGreaterThan(0);
    expect(Number(c.pnl)).toBe(expected);
    expect((await profile()).balance).toBeCloseTo(before + expected, 2);
    const tx = await sql<{ amount: string; balance_after: string; account_type: string }>(
      `select amount, balance_after, account_type from public.wallet_transactions where user_id = $1 and type = 'pnl' order by created_at desc limit 1`, [fx.clientId]);
    expect(Number(tx[0].amount)).toBe(expected);
    expect(Number(tx[0].balance_after)).toBeCloseTo(before + expected, 2);
    expect(tx[0].account_type).toBe("demo");
    expect((await profile()).other).toBe(walletBefore.other); // the parked real wallet never moves
  });
  test("4d. the take-profit close is announced with the right reason, numbers and wording", async () => {
    const [p] = await positions();
    const n = await lastNotification("copy_closed");
    expect(n.data).toMatchObject({ symbol: "BTCUSDT", reason: "tp", positive: true });
    expect(Number(n.data.amount)).toBe(Math.abs(Number(p.pnl)));
    await client.goto(`${BASE}/notifications`);
    const text = await bodyText(client);
    expect(text).toContain("Take profit reached");
    expect(text).toContain(`Your BTCUSDT trade copied from E2E Leader ${RUN_TAG} closed at your take profit with a result of +${fmt2(Number(p.pnl))} USDT.`);
    // and the copy-opened notice for the same trade arrived earlier
    expect(text).toContain("New trade copied");
  });

  async function editRisk(tp: string, sl: string, trailing: string, applyToOpen = false) {
    await client.goto(`${BASE}/copies`);
    await client.getByText("Trade settings (take profit / stop loss / trailing)").click();
    await client.locator("input[name=takeProfitPct]").fill(tp);
    await client.locator("input[name=tradeStopLossPct]").fill(sl);
    await client.locator("input[name=trailingPct]").fill(trailing);
    const box = client.locator("input[name=applyToOpen]");
    if (applyToOpen) await box.check();
    await client.getByRole("button", { name: "Save settings" }).click();
  }

  test("4e. trailing stop follows the best price and closes only on the configured pullback", async () => {
    await editRisk("", "3", "2");
    await expect(client).toHaveURL(/saved=1/);
    expect(await bodyText(client)).toContain("Copy settings saved.");
    const sub = await sql<{ tp_pct: string | null; sl_pct: string; trailing_pct: string }>(`select tp_pct, sl_pct, trailing_pct from public.subscriptions where follower_id = $1 and is_active`, [fx.clientId]);
    expect(sub[0].tp_pct).toBeNull();
    expect(Number(sub[0].sl_pct)).toBe(3);
    expect(Number(sub[0].trailing_pct)).toBe(2);

    await leaderOpen("BTCUSDT", "buy");
    await expect.poll(async () => (await positions()).length).toBe(2);
    const p = (await positions())[1];
    const entry = Number(p.entry_price);
    expect(Number(p.trail_pct)).toBe(2);
    expect(Number(p.best_price)).toBe(entry);
    expect(p.take_profit).toBeNull();
    expect(Number(p.stop_loss)).toBeCloseTo(entry * 0.97, 6);

    const before = (await profile()).balance;
    const peak = Math.round(entry * 1.03 * 100) / 100;
    await pricePath("BTCUSDT", async () => {
      await setPrice("BTCUSDT", peak);
      let cur = (await positions())[1];
      expect(cur.status).toBe("open");
      expect(Number(cur.best_price)).toBe(peak); // best price ratchets up
      await setPrice("BTCUSDT", Math.round(peak * 0.99 * 100) / 100); // 1% pullback: still inside the 2%
      cur = (await positions())[1];
      expect(cur.status).toBe("open");
      expect(Number(cur.best_price)).toBe(peak); // and never moves back down
      const exit = Math.round(peak * 0.979 * 100) / 100; // 2.1% pullback
      await setPrice("BTCUSDT", exit);
      cur = (await positions())[1];
      expect(cur.status).toBe("closed");
      expect(Number(cur.exit_price)).toBe(exit);
      const expected = pnlOf("buy", entry, exit, 800);
      expect(expected).toBeGreaterThan(0); // locked in a profit
      expect(Number(cur.pnl)).toBe(expected);
      expect((await profile()).balance).toBeCloseTo(before + expected, 2);
      const n = await lastNotification("copy_closed");
      expect(n.data).toMatchObject({ reason: "trailing", positive: true });
    });
    await client.goto(`${BASE}/notifications`);
    expect(await bodyText(client)).toContain("Trailing stop triggered");
  });

  test("4f. a SELL is copied inverted; edited settings apply to the open trade; stop-loss closes it at a loss", async () => {
    await editRisk("", "3", "2"); // reset to a known state
    await leaderOpen("BTCUSDT", "sell");
    await expect.poll(async () => (await positions()).length).toBe(3);
    let p = (await positions())[2];
    const entry = Number(p.entry_price);
    expect(p.side).toBe("sell");
    expect(Number(p.stop_loss)).toBeCloseTo(entry * 1.03, 6); // a sell's stop is ABOVE the entry
    expect(Number(p.trail_pct)).toBe(2);
    // change the settings and apply them to the trade that is already open
    await editRisk("4", "2", "", true);
    await expect(client).toHaveURL(/saved=1/);
    p = (await positions())[2];
    expect(Number(p.take_profit)).toBeCloseTo(entry * 0.96, 6);
    expect(Number(p.stop_loss)).toBeCloseTo(entry * 1.02, 6);
    expect(p.trail_pct).toBeNull();
    expect(p.best_price).toBeNull();
    // price rallies through the stop
    const before = (await profile()).balance;
    const exit = Math.round(entry * 1.025 * 100) / 100;
    await pricePath("BTCUSDT", () => setPrice("BTCUSDT", exit));
    p = (await positions())[2];
    expect(p.status).toBe("closed");
    const expected = pnlOf("sell", entry, exit, 800);
    expect(expected).toBeLessThan(0);
    expect(Number(p.pnl)).toBe(expected);
    expect((await profile()).balance).toBeCloseTo(before + expected, 2);
    const n = await lastNotification("copy_closed");
    expect(n.data).toMatchObject({ reason: "sl", positive: false });
    await client.goto(`${BASE}/notifications`);
    const text = await bodyText(client);
    expect(text).toContain("Stop loss triggered");
    expect(text).toContain(`closed at your stop loss with a result of -${fmt2(Math.abs(expected))} USDT.`);
  });

  test("4g. closing a trade by hand settles at the live price", async () => {
    await leaderOpen("ETHUSDT", "buy");
    await expect.poll(async () => (await positions()).length).toBe(4);
    const before = (await profile()).balance;
    await client.goto(`${BASE}/dashboard`);
    client.once("dialog", (d) => d.accept());
    await client.getByRole("button", { name: "Close", exact: true }).first().click();
    await expect.poll(async () => (await positions())[3].status).toBe("closed");
    const p = (await positions())[3];
    const entry = Number(p.entry_price);
    const exit = Number(p.exit_price);
    expect(Math.abs(exit - (await getPrice("ETHUSDT"))) / exit).toBeLessThan(0.01);
    const expected = pnlOf("buy", entry, exit, 800);
    expect(Number(p.pnl)).toBe(expected);
    expect((await profile()).balance).toBeCloseTo(before + expected, 2);
    const n = await lastNotification("copy_closed");
    expect(n.data).toMatchObject({ symbol: "ETHUSDT", reason: "manual" });
    await client.goto(`${BASE}/notifications`);
    expect(await bodyText(client)).toContain("Trade closed");
  });

  test("4h. when the trader closes the trade, every copy closes at the trader's exit price", async () => {
    await leaderOpen("SOLUSDT", "sell");
    await expect.poll(async () => (await positions()).length).toBe(5);
    const before = (await profile()).balance;
    await leader.goto(`${BASE}/lead/trades`);
    await leader.getByRole("button", { name: "Close", exact: true }).first().click();
    await expect.poll(async () => (await positions())[4].status).toBe("closed");
    const p = (await positions())[4];
    const [sig] = await sql<{ exit_price: string; status: string; entry_price: string }>(`select exit_price, status, entry_price from public.signals where id = $1`, [p.signal_id]);
    expect(sig.status).toBe("closed");
    expect(Number(p.exit_price)).toBe(Number(sig.exit_price));
    const expected = pnlOf("sell", Number(p.entry_price), Number(sig.exit_price), 800);
    expect(Number(p.pnl)).toBe(expected);
    expect((await profile()).balance).toBeCloseTo(before + expected, 2);
    const n = await lastNotification("copy_closed");
    expect(n.data).toMatchObject({ symbol: "SOLUSDT", reason: "leader" });
    await client.goto(`${BASE}/notifications`);
    const text = await bodyText(client);
    expect(text).toContain(`Trade closed · E2E Leader ${RUN_TAG}`);
  });

  test("4i. the trader's own BTC trades stay open when a follower's copy closes on its own rules", async () => {
    const open = await sql<{ n: string }>(`select count(*) n from public.signals where provider_id = $1 and status = 'open' and symbol = 'BTCUSDT'`, [fx.providerId]);
    expect(Number(open[0].n)).toBe(3);
  });

  // ---------------------------------------------------------------- 5. accounting, history, stats
  test("5a. the wallet equals 10,000 + every realised result, to the cent, and the real wallet is untouched", async () => {
    const closed = await positions();
    expect(closed.every((p) => p.status === "closed")).toBe(true);
    const sum = r2(closed.reduce((s, p) => s + Number(p.pnl), 0));
    const p = await profile();
    expect(p.balance).toBeCloseTo(10000 + sum, 2);
    const tx = await sql<{ n: string; total: string }>(`select count(*) n, coalesce(sum(amount),0) total from public.wallet_transactions where user_id = $1 and type = 'pnl' and account_type = 'demo'`, [fx.clientId]);
    expect(Number(tx[0].n)).toBe(closed.length);
    expect(Number(tx[0].total)).toBeCloseTo(sum, 2);
    expect(p.other).toBe(realWallet); // the real wallet is exactly where it was before trading
    const real = await sql<{ n: string }>(`select count(*) n from public.wallet_transactions where user_id = $1 and type = 'pnl' and account_type = 'real'`, [fx.clientId]);
    expect(Number(real[0].n)).toBe(0);
  });

  test("5b. history lists every closed trade with its exact result; dashboard and portfolio totals agree", async () => {
    const closed = await positions();
    const sum = r2(closed.reduce((s, p) => s + Number(p.pnl), 0));
    const wins = closed.filter((p) => Number(p.pnl) > 0).length;
    await client.goto(`${BASE}/trades?tab=history`);
    const hist = await bodyText(client);
    expect(hist).toContain(`${closed.length} trades · ${sum >= 0 ? "+" : "-"}${fmt2(Math.abs(sum))} USDT`);
    for (const p of closed) {
      const dir = p.side === "sell" ? -1 : 1;
      const pct = ((Number(p.exit_price) - Number(p.entry_price)) / Number(p.entry_price)) * 100 * dir;
      expect(hist).toContain(`${pct >= 0 ? "+" : "-"}${Math.abs(pct).toFixed(2)}%`);
      expect(hist).toContain(`${p.side} ${fmt2(Number(p.size))} USDT`);
    }
    await client.goto(`${BASE}/portfolio`);
    const port = await bodyText(client);
    expect(port).toContain(`${sum >= 0 ? "+" : "-"}${fmt2(Math.abs(sum))} USDT`);
    expect(port).toContain(`${Math.round((wins / closed.length) * 100)}%`);
    await client.goto(`${BASE}/dashboard`);
    const dash = await bodyText(client);
    expect(dash).toContain(usdt(10000 + sum));
  });
  // ---------------------------------------------------------------- 3e/4j. stop copying, copy-open, races, stale prices
  test("4j. stale prices block a manual close with a clear message; the trade stays open", async () => {
    await leaderOpen("XRPUSDT", "buy");
    await expect.poll(async () => (await positions()).length).toBe(6);
    await sql(`update public.market_prices set updated_at = now() - interval '10 minutes' where symbol = 'XRPUSDT'`);
    try {
      await client.goto(`${BASE}/dashboard`);
      client.once("dialog", (d) => d.accept());
      await client.getByRole("button", { name: "Close", exact: true }).first().click();
      await expect(client).toHaveURL(/error=/);
      expect(await bodyText(client)).toContain("Prices are being refreshed. Please try again in a moment.");
      expect((await positions())[5].status).toBe("open");
    } finally {
      await sql(`update public.market_prices set updated_at = now() where symbol = 'XRPUSDT'`);
    }
  });

  test("4k. stopping the copy closes what is open, releases the allocation and keeps the numbers exact", async () => {
    await client.goto(`${BASE}/copies`);
    client.once("dialog", (d) => d.accept());
    await client.getByRole("button", { name: "Stop copying" }).click();
    await expect(client.getByText("You are not copying anyone yet.")).toBeVisible();
    const p = (await positions())[5];
    expect(p.status).toBe("closed");
    const sub = await sql<{ is_active: boolean }>(`select is_active from public.subscriptions where follower_id = $1`, [fx.clientId]);
    expect(sub[0].is_active).toBe(false);
    await client.goto(`${BASE}/portfolio`);
    expect(await bodyText(client)).not.toContain("Reserved for active copying ");
  });

  test("4l. 'copy open trades' copies the trader's open trade at the market with the right size, once, even on a race", async () => {
    // leader still has open BTC trades from earlier; new copy with copy-open on, started twice at once
    const { createClient } = await import("@supabase/supabase-js");
    const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await api.auth.signInWithPassword({ email: CLIENT_EMAIL, password: PASSWORD });
    expect(signInError).toBeNull();
    const args = { p_provider_id: fx.providerId, p_allocated_amount: 3000, p_copy_mode: "fixed", p_fixed_amount: 500, p_max_per_trade: null, p_stop_loss_pct: null, p_tp_pct: null, p_sl_pct: null, p_trailing_pct: null, p_copy_open: true };
    const before = (await positions()).length;
    const open = await sql<{ n: string }>(`select count(*) n from public.signals where provider_id = $1 and status = 'open' and not hidden`, [fx.providerId]);
    const results = await Promise.all([api.rpc("start_or_update_copy", args), api.rpc("start_or_update_copy", args)]);
    expect(results.filter((r) => !r.error).length).toBeGreaterThanOrEqual(1);
    const all = await positions();
    const fresh = all.slice(before);
    expect(fresh).toHaveLength(Number(open[0].n)); // one copy per open trade, no duplicates
    for (const f of fresh) {
      expect(Number(f.size)).toBe(500);
      const price = await getPrice(f.symbol);
      expect(Math.abs(Number(f.entry_price) - price) / price).toBeLessThan(0.01); // market price, not the trader's entry
    }
    await api.auth.signOut({ scope: "local" }); // local only: a global sign-out would end the browser session too
    const subs = await sql<{ n: string }>(`select count(*) n from public.subscriptions where follower_id = $1 and is_active`, [fx.clientId]);
    expect(Number(subs[0].n)).toBe(1);
    const n = await sql<{ n: string }>(`select count(*) n from public.notifications where user_id = $1 and type = 'copy_opened'`, [fx.clientId]);
    expect(Number(n[0].n)).toBeGreaterThanOrEqual(fresh.length);
  });

  test("4m. stopping from the dashboard closes the copied trades first, then stops", async () => {
    await client.goto(`${BASE}/copies`);
    client.once("dialog", (d) => d.accept());
    await client.getByRole("button", { name: "Stop copying" }).click();
    await expect(client.getByText("You are not copying anyone yet.")).toBeVisible();
    const open = await sql<{ n: string }>(`select count(*) n from public.simulated_positions where follower_id = $1 and status = 'open'`, [fx.clientId]);
    expect(Number(open[0].n)).toBe(0);
    const closed = await positions();
    const sum = r2(closed.reduce((s, p) => s + Number(p.pnl), 0));
    expect((await profile()).balance).toBeCloseTo(10000 + sum, 2);
  });

  // ---------------------------------------------------------------- 6. notifications in other languages
  test("6a. every notification reads correctly in Arabic and a sample of other languages", async () => {
    const rows = await sql<{ type: string; data: Record<string, unknown> }>(`select type, data from public.notifications where user_id = $1 and type in ('copy_opened','copy_closed')`, [fx.clientId]);
    expect(rows.length).toBeGreaterThan(8);
    const samples: [string, string][] = [["ar", "تم الوصول إلى جني الأرباح"], ["fr", "Objectif de profit atteint"], ["es", "Objetivo de beneficio alcanzado"], ["zh", "已达到止盈"], ["th", "ถึงเป้าหมายทำกำไรแล้ว"], ["ur", "ٹیک پرافٹ حاصل ہو گیا"]];
    for (const [loc, title] of samples) {
      await clientCtx.addCookies([{ name: "locale", value: loc, url: BASE }]);
      await client.goto(`${BASE}/notifications`);
      const text = await bodyText(client);
      expect(text, loc).toContain(title);
      expect(text, loc).not.toMatch(/\{[a-zA-Z]+\}|\bundefined\b|\bNaN\b|\[object|copyClosed|Notifications\./);
      expect(text, loc).toMatch(/\d[\d,]*\.\d{2}/); // amounts are present
    }
    await clientCtx.addCookies([{ name: "locale", value: "en", url: BASE }]);
  });

  // ---------------------------------------------------------------- 8. wording: no technical text anywhere
  test("8. no page shows error codes, raw keys, placeholders or developer wording (English and Arabic)", async () => {
    test.setTimeout(240_000);
    const paths = ["/dashboard", "/portfolio", "/portfolio?tab=positions", "/portfolio?tab=activity", "/portfolio/deposit", "/portfolio/withdraw", "/discover", "/copies", "/trades", "/trades?tab=history", "/notifications", "/notifications/preferences", "/settings", "/account/security", "/account/sessions", "/kyc", "/markets", "/support", `/trader/${fx.providerId}`];
    const bad = /\bCM\d{3}\b|\bLT\d{3}\b|\bundefined\b|\bNaN\b|\[object|\bnull\b|\{[a-zA-Z]+\}|[a-z]+_[a-z]+_[a-z_]+|\bTODO\b|Error:|\bexception\b|(?<!\/)\bUSD\b(?![T\/])|\$\d/;
    for (const loc of ["en", "ar"]) {
      await clientCtx.addCookies([{ name: "locale", value: loc, url: BASE }]);
      for (const path of paths) {
        await client.goto(`${BASE}${path}`);
        const text = await bodyText(client);
        const m = bad.exec(text);
        expect(m ? `${loc} ${path}: "${text.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\n/g, " ")}"` : "ok", `${loc} ${path}`).toBe("ok");
      }
    }
    await clientCtx.addCookies([{ name: "locale", value: "en", url: BASE }]);
  });

  // ---------------------------------------------------------------- 1g. sign out
  test("9. signing out ends the session and protected pages ask to sign in again", async () => {
    await client.goto(`${BASE}/dashboard`);
    await client.getByRole("button", { name: "Menu" }).click();
    await client.getByRole("button", { name: "Log out" }).first().click();
    await client.locator("[aria-labelledby=logout-confirm-title]").getByRole("button", { name: "Log out" }).click();
    await expect(client).toHaveURL(/\/$/, { timeout: 20_000 });
    await client.goto(`${BASE}/portfolio`);
    await expect(client).toHaveURL(/\/login/);
  });
});
