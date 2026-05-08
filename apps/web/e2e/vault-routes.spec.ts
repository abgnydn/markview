import { test, expect } from '@playwright/test';

test.describe('vault · routes', () => {
  test('landing page renders with Vault link in nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav').getByRole('link', { name: /vault/i })).toBeVisible();
  });

  test('/vault mounts the 3D canvas and topbar', async ({ page }) => {
    await page.goto('/vault');
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByTestId('topbar-new')).toBeVisible();
    await expect(page.getByTestId('topbar-edges')).toBeVisible();
    await expect(page.getByTestId('topbar-layout')).toBeVisible();
    await expect(page.getByTestId('topbar-semantic')).toBeVisible();
    await expect(page.getByTestId('topbar-doc-count')).toBeVisible();
  });

  test('/vault defaults to solo mode (Collab visible, Leave absent)', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/vault');
    await expect(page.getByTestId('topbar-collab')).toBeVisible();
    await expect(page.getByTestId('topbar-leave')).toHaveCount(0);
  });

  test('/vault/room?id=… mounts in room mode (Leave visible, LIVE badge)', async ({ page }) => {
    await page.goto('/vault/room?id=mkv-e2etest');
    await expect(page.getByTestId('topbar-leave')).toBeVisible();
    await expect(page.getByTestId('topbar-collab')).toHaveCount(0);
    await expect(page.locator('text=LIVE').first()).toBeVisible({ timeout: 5000 });
  });

  test('/vault loads without relevant console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/vault');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(500);
    // Ignore third-party noise that's not regression-relevant.
    const relevant = errors.filter(
      (e) =>
        !/Yjs was already imported/i.test(e) &&
        !/THREE\.(Clock|Timer).*deprecated/i.test(e) &&
        !/sw\.js/i.test(e) &&
        !/Failed to fetch/i.test(e) &&
        !/icon-192\.png/i.test(e) &&
        !/\/api\/brain\/fleet/i.test(e),
    );
    expect(relevant).toEqual([]);
  });
});
