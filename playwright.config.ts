import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  // Windows composited header text varies by up to 152 edge pixels across runs.
  // Keep a small absolute allowance; layout/overflow/axe assertions stay strict.
  expect: { timeout: 15_000, toHaveScreenshot: { maxDiffPixels: 200 } },
  workers: 1,
  fullyParallel: false,
  retries: 1,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm exec wrangler d1 migrations apply DB --local --config wrangler.test.jsonc && node scripts/seed-browser-fixture.mjs && pnpm exec vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_LOG_PATH: ".wrangler/logs", WRANGLER_WRITE_LOGS: "false", SELLERHISAB_TEST: "1", APP_ENV: "test", ENTITLEMENT_SECRET: "test-entitlement-secret-32-characters-minimum", SESSION_SECRET: "test-session-secret-value-32-characters-minimum" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ...(process.env.NIGHTLY ? [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }] : []),
  ],
});
