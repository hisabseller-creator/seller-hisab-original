import path from "node:path";
import { expect, test } from "@playwright/test";

const fixtures = path.resolve("tests/fixtures");
const costs = "SKU-BLUE-M\t305\t14\nSKU-BOX-6\t290\t21\nSKU-SANDAL-6\t380\t18\nSKU-PENDING\t115\t12";

async function runBasicAnalysis(page: import("@playwright/test").Page) {
  await page.goto("/analyze");
  await expect(page.locator('input[type="file"]').first()).toBeEnabled();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixtures, "payments-basic.csv"));
  await expect(page.getByText("payments-basic.csv", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Paste costs" }).click();
  await page.locator("#cost-paste").fill(costs);
  await page.getByRole("button", { name: "See My Margin — Free" }).click();
  await expect(page.getByRole("heading", { name: "Your money snapshot" })).toBeVisible({ timeout: 20_000 });
}

test("landing explains the real product without a public demo path", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main.website-home")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Check my profit", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore supported workflows", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore free calculators", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Try Demo/i })).toHaveCount(0);
});

test("valid payment report produces a free result and source-backed audit trail", async ({ page }) => {
  await runBasicAnalysis(page);
  await expect(page.getByText("Confirmed Contribution").first()).toBeVisible();
  await page.getByRole("button", { name: /Why\?/ }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Settlement received");
});

test("free result stays limited without invoking a real payment provider", async ({ page }) => {
  await runBasicAnalysis(page);
  await expect(page.getByRole("button", { name: "Unlock Action Report — ₹49" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Excel" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PDF" })).toHaveCount(0);
});

test("unknown format fails closed and preserves the wizard", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.locator('input[type="file"]').first()).toBeEnabled();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixtures, "unknown-format.csv"));
  await page.getByRole("button", { name: "See My Margin — Free" }).click();
  await expect(page.getByText("Safe calculation stopped")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/cannot safely calculate profit|New report format/i)).toBeVisible();
  await expect(page.getByText("unknown-format.csv")).toBeVisible();
});

test("account screen exposes password login, mobile registration and mobile password reset", async ({ page }) => {
  await page.goto("/app");
  const auth = page.locator(".auth-form-panel");

  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(auth.locator("#login-identifier")).toBeVisible();
  await expect(auth.locator("#login-password")).toBeVisible();

  await auth.getByRole("tab", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "Create your account." })).toBeVisible();
  await expect(auth.locator("#register-phone")).toBeVisible();
  await expect(auth.locator("#register-password")).toBeVisible();
  await expect(auth.getByRole("button", { name: "Register with mobile OTP" })).toBeVisible();

  await auth.getByRole("tab", { name: "Login" }).click();
  await auth.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();
  await expect(auth.locator("#reset-phone")).toBeVisible();
  await expect(auth.locator("#reset-password")).toBeVisible();
  await expect(page.getByText(/Preview OTP:/)).toHaveCount(0);
});
