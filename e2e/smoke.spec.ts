import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = "navtest.cm@gmail.com";
const TEST_PASSWORD = "test123456";

test.describe.serial("Copy Matrix smoke tests", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // The suite asserts Arabic copy (the default locale); pin it regardless of browser language.
    const context = await browser.newContext({ locale: "ar" });
    await context.addCookies([{ name: "locale", value: "ar", url: "http://localhost:3000" }]);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("unauthenticated access to the dashboard redirects to login", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logging in with valid credentials reaches the dashboard", async () => {
    await page.goto("/login");
    await page.getByPlaceholder("البريد الإلكتروني").fill(TEST_EMAIL);
    await page.getByPlaceholder("كلمة المرور").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("مرحبًا")).toBeVisible();
  });

  test("discover page lists traders and follow controls are present", async () => {
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "اكتشاف المتداولين" })).toBeVisible();
    const copyControls = page.getByRole("link", { name: "نسخ" }).or(page.getByRole("button", { name: "إيقاف النسخ" }));
    await expect(copyControls.first()).toBeVisible();
  });

  test("portfolio page shows the wallet balance", async () => {
    await page.goto("/portfolio");
    await expect(page.getByText("نقدي متاح للسحب").first()).toBeVisible();
  });

  test("legal pages render", async () => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("heading", { name: "الشروط والأحكام" })).toBeVisible();
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { name: "سياسة الخصوصية" })).toBeVisible();
  });

  test("unknown route renders the themed 404 page", async () => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText("404")).toBeVisible();
  });

  test("logout returns to the public homepage", async () => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "القائمة" }).click();
    // The menu's logout asks for confirmation first (aria-labelledby=logout-confirm-title).
    await page.getByRole("button", { name: "تسجيل الخروج" }).first().click();
    await page.locator("[aria-labelledby=logout-confirm-title]").getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
