import { test, expect, type Page } from "@playwright/test";

const SITE_PASSWORD = process.env.SITE_ACCESS_PASSWORD!;
const TEST_EMAIL = "navtest.cm@gmail.com";
const TEST_PASSWORD = "test123456";

test.describe.serial("Copy Matrix smoke tests", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("site gate blocks unauthenticated access and unlocks with the password", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/gate/);
    await page.getByPlaceholder("كلمة المرور").fill(SITE_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/gate")),
      page.getByRole("button", { name: "دخول" }).click(),
    ]);
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
    const followButtons = page.getByRole("button", { name: /متابعة|إلغاء المتابعة/ });
    await expect(followButtons.first()).toBeVisible();
  });

  test("portfolio page shows the wallet balance", async () => {
    await page.goto("/portfolio");
    await expect(page.getByText("الرصيد المتاح")).toBeVisible();
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

  test("logout returns to the login page", async () => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
