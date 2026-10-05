import { defineConfig } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // Long journey steps (a dozen page loads against the dev server) need more than the default 30s.
  timeout: 90_000,
  // First hits compile on the dev server; server actions can take longer than the default 5s.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
