import { test, expect } from "@playwright/test";

// The same leader carries the same risk badge everywhere a visitor can see it: the landing page
// card, the discover card, the profile and the compare table (one source: provider_stats.risk_level,
// migration 0265). Read-only; runs against a local server or E2E_BASE_URL.
test("a leader's risk badge is the same on the landing page, discover, the profile and compare", async ({ page }) => {
  await page.goto("/");
  const firstCard = page.locator("#traders a[href^='/trader/']").first();
  const href = await firstCard.getAttribute("href");
  expect(href).toBeTruthy();
  const id = href!.split("/").pop()!.split("#")[0];
  const landing = await page.locator("#traders [data-risk]").first().getAttribute("data-risk");
  expect(landing).toMatch(/^risk(Low|Medium|High)$/);

  await page.goto(`/trader/${id}`);
  expect(await page.locator("h1 ~ [data-risk], h1 + * [data-risk], main [data-risk]").first().getAttribute("data-risk")).toBe(landing);

  await page.goto("/discover?period=30d&sort=roi");
  const discoverCard = page.locator(`a[href='/trader/${id}']`).first().locator("xpath=..");
  if ((await discoverCard.count()) > 0) {
    expect(await discoverCard.locator("[data-risk]").first().getAttribute("data-risk")).toBe(landing);
  }

  // compare it with any other leader on the page
  const other = await page.locator("a[href^='/trader/']").evaluateAll((as, me) =>
    as.map((a) => (a.getAttribute("href") ?? "").split("/").pop()).find((x) => x && x !== me), id);
  await page.goto(`/discover/compare?ids=${id},${other}`);
  const column = await page.locator("thead th a").evaluateAll((as, me) => as.findIndex((a) => a.getAttribute("href") === `/trader/${me}`), id);
  expect(column).toBeGreaterThanOrEqual(0);
  const badges = page.locator("tbody tr").first().locator("td").nth(column + 1).locator("[data-risk]");
  expect(await badges.getAttribute("data-risk")).toBe(landing);
});
