import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 1280]) test('login loading and provider error states ' + width, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.setViewportSize({ width, height: 900 });

  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  await page.route('**/api/auth/password/login', async (route) => {
    await gate;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Sign-in is temporarily unavailable. Please try again.' }),
    });
  });

  await page.goto('/app');
  await expect(page.locator('#login-identifier')).toBeVisible();
  await page.locator('#login-identifier').fill('fixture@example.invalid');
  await page.locator('#login-password').fill('FixturePassword123!');

  const button = page.getByRole('button', { name: 'Login', exact: true }).last();
  await button.click();

  // Transient loading state: assert behavior directly instead of comparing a
  // full-page bitmap whose spinner/rasterization can vary between Windows runs.
  await expect(button).toBeDisabled();
  const loadingSpinner = button.locator('svg.animate-spin');
  await expect(loadingSpinner).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

  release();

  const errorMessage = 'Sign-in is temporarily unavailable. Please try again.';
  await expect(page.getByText(errorMessage)).toBeVisible();
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible();
  await expect(button).toBeEnabled();

  // The light-theme contrast fix is the contract we care about here. Test the
  // actual Sonner design token rather than pinning the whole page to a stale PNG.
  await expect(page.locator('.toaster')).toHaveCSS('--error-text', '#c40000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

test('auth illustration respects motion preference and remains accessible when CDN fails', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let animationRequests = 0;

  await page.route('**/lottie.min.js', async (route) => {
    animationRequests++;
    await route.abort();
  });

  await page.goto('/app');
  await expect(page.locator('#login-identifier')).toBeVisible();

  const illustration = page.getByRole('img', { name: 'Secure OTP sign-in illustration' });
  await expect(illustration.locator('svg.lucide')).toBeVisible();
  expect(animationRequests).toBe(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => animationRequests).toBe(1);
  await expect(illustration.locator('svg.lucide')).toBeVisible();

  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});
