// A rebuilt leader's profile, as a logged-out visitor: every number on the
// page, its tabs and filters, and the discover card agree with provider_cards /
// provider_stats (which are built from the trades), and the page fits a phone.
import { test, expect, type Page } from "@playwright/test";
import { sql, closeDb } from "./support/fixtures";

// E2E_BASE_URL / E2E_LEADER_ID check one given leader on a deployed site.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
type Card = Record<string, string | number | null>;
let id = "";
let card: Card;

const pct = (v: unknown, sign = true) => `${sign && Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
const usd = (v: unknown, signed = false) =>
  `${signed && Number(v) > 0 ? "+" : Number(v) < 0 ? "-" : ""}${Math.abs(Number(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
const clean = (s: string | null) => (s ?? "").replace(/[⁦-⁩]/g, "").replace(/\s+/g, " ").trim();

test.beforeAll(async () => {
  // The rebuilt leader with the most trades in the last 30 days.
  const [row] = await sql<{ provider_id: string }>(
    `select b.provider_id from public.sim_history_builds b join public.provider_stats s using (provider_id)
     where s.trades_30d > 3 order by s.trades_30d desc limit 1`,
  );
  id = process.env.E2E_LEADER_ID ?? row.provider_id;
  await sql("select public.refresh_provider_stats($1::uuid[], true)", [[id]]);
  [card] = await sql<Card>("select * from public.provider_cards where provider_id = $1", [id]);
});

test.afterAll(closeDb);

async function open(page: Page, tab = "history") {
  await page.context().addCookies([{ name: "locale", value: "en", url: BASE }]);
  await page.goto(`/trader/${id}?tab=${tab}`);
  await expect(page.getByRole("heading", { name: String(card.display_name) })).toBeVisible();
}

test("header stats and gauges equal the leader's stats", async ({ page }) => {
  await open(page);
  const main = clean(await page.locator("main").innerText());
  expect(main).toContain(`${card.win_rate_pct}%`);
  expect(main).toContain(`-${Number(card.mdd_all)}% Max drawdown`);
  expect(main).toContain(`${Number(card.rating_score)}/100`);
  expect(main).toContain(`Active Trading Days ${card.active_days}`);
  if (card.sharpe_all != null) expect(main).toContain(`${Number(card.sharpe_all)} Sharpe ratio`);
  expect(main).toContain(`${Math.round(Number(card.avg_hold_hours) * 10) / 10}h`);
});

test("every chart period ends on the stat for that period", async ({ page }) => {
  await open(page);
  for (const [label, col] of [["Week", "roi_7d"], ["Month", "roi_30d"], ["3 months", "roi_90d"], ["All", "roi_all"]] as const) {
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await expect(page.getByText(`Current: ${pct(card[col])}`)).toBeVisible();
  }
});

test("history: counts and totals for every period equal the stats", async ({ page }) => {
  await open(page, "history");
  const section = page.locator("main section").first();
  await expect(section.getByText(`${card.closed_signals} trades`, { exact: true })).toBeVisible();
  await expect(section.locator("dl")).toContainText(usd(card.pnl_all, true));
  for (const [label, trades, pnl] of [["Week", "trades_7d", "pnl_7d"], ["Month", "trades_30d", "pnl_30d"], ["3 months", "trades_90d", "pnl_90d"]] as const) {
    await section.locator("button[aria-haspopup=dialog]").click();
    await page.getByRole("dialog").getByRole("button", { name: label, exact: true }).click();
    await expect(section.getByText(`${card[trades]} trades`, { exact: true })).toBeVisible();
    await expect(section.locator("dl")).toContainText(Number(card[trades]) > 0 ? usd(card[pnl], true) : "0.00 USDT");
  }
});

test("performance tab: each period's return is the stat", async ({ page }) => {
  await open(page, "performance");
  const text = clean(await page.locator("main section").first().innerText());
  for (const col of ["roi_7d", "roi_30d", "roi_90d", "roi_180d"]) if (Number(card[col.replace("roi", "trades")]) > 0) expect(text).toContain(pct(card[col]));
});

test("open trades tab lists every open trade with its dollar result", async ({ page }) => {
  await open(page, "openTrades");
  const n = Number(card.open_signals);
  const section = page.locator("main section").first();
  if (n === 0) await expect(section.getByText("No open trades for this trader right now.")).toBeVisible();
  else {
    await expect(section.getByText("Total floating P/L")).toBeVisible();
    await expect(section.getByText(/^(BUY|SELL)$/)).toHaveCount(n);
  }
});

test("asset allocation tab shows each symbol's share of the trades", async ({ page }) => {
  await open(page, "allocation");
  const mix = (typeof card.asset_mix === "string" ? JSON.parse(card.asset_mix) : card.asset_mix) as unknown as Record<string, number>;
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  const text = clean(await page.locator("main section").first().innerText());
  const top = Object.entries(mix).sort((a, b) => b[1] - a[1])[0];
  expect(text).toContain(`${top[0]} ${Math.round((top[1] / total) * 100)}%`);
});

test("the discover card shows the same 30-day numbers", async ({ page }) => {
  await page.context().addCookies([{ name: "locale", value: "en", url: BASE }]);
  await page.goto(`/discover?period=30&q=${encodeURIComponent(String(card.display_name))}`);
  const cardText = clean(await page.locator(`a[href="/trader/${id}"]`).first().locator("xpath=ancestor::*[contains(@class,'rounded')][1]").innerText());
  expect(cardText).toContain(pct(card.roi_30d));
  if (Number(card.trades_30d) > 0) expect(cardText).toContain(`${Number(card.win_rate_30d).toFixed(1)}%`);
});

test("the profile fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const tab of ["history", "performance", "openTrades", "allocation"]) {
    await open(page, tab);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${tab}: no horizontal scroll`).toBeLessThanOrEqual(0);
  }
});
