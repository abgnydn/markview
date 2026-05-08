import { test, expect, Page } from '@playwright/test';

async function docCount(page: Page): Promise<number> {
  const raw = await page.getByTestId('topbar-doc-count').getAttribute('data-doc-count');
  return raw ? Number(raw) : 0;
}

async function gotoVaultFresh(page: Page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/vault');
  await expect(page.locator('canvas').first()).toBeVisible();
  // Wait for vault state to hydrate (seed docs mount) before proceeding.
  // Cold dev-server compiles can delay this by several seconds.
  await expect
    .poll(() => docCount(page), { timeout: 15000, intervals: [200, 500, 1000] })
    .toBeGreaterThan(0);
}

test.describe('vault · topbar', () => {
  test('+ New increments doc count by 1', async ({ page }) => {
    await gotoVaultFresh(page);
    const before = await docCount(page);
    await page.getByTestId('topbar-new').click();
    await expect
      .poll(() => docCount(page), { timeout: 10000, intervals: [200, 500] })
      .toBe(before + 1);
  });

  test('+50 increments doc count by 50', async ({ page }) => {
    await gotoVaultFresh(page);
    const before = await docCount(page);
    await page.getByTestId('topbar-seed').click();
    await expect
      .poll(() => docCount(page), { timeout: 15000, intervals: [200, 500, 1000] })
      .toBe(before + 50);
  });

  test('Edges toggle flips data-pressed', async ({ page }) => {
    await gotoVaultFresh(page);
    const btn = page.getByTestId('topbar-edges');
    const initial = await btn.getAttribute('data-pressed');
    await btn.click();
    await expect(btn).toHaveAttribute(
      'data-pressed',
      initial === 'true' ? 'false' : 'true',
    );
  });

  test('Cluster toggle swaps data-layout between ring and cluster', async ({ page }) => {
    await gotoVaultFresh(page);
    const btn = page.getByTestId('topbar-layout');
    await expect(btn).toHaveAttribute('data-layout', 'ring');
    await btn.click();
    await expect(btn).toHaveAttribute('data-layout', 'cluster');
    await btn.click();
    await expect(btn).toHaveAttribute('data-layout', 'ring');
  });

  test('Semantic toggle flips data-pressed and shows a status chip', async ({ page }) => {
    await gotoVaultFresh(page);
    const btn = page.getByTestId('topbar-semantic');
    await expect(btn).toHaveAttribute('data-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('data-pressed', 'true');
    // Chip appears as a <span> child with one of the three source labels.
    // On a fresh toggle it'll be 'model ...' (loading), then flip to 'ai' or 'tf-idf'.
    const chip = btn.locator('span').filter({ hasText: /tf-idf|ai|model/i });
    await expect(chip.first()).toBeVisible({ timeout: 10000 });
  });

  test('FPS toggle flips data-pressed', async ({ page }) => {
    await gotoVaultFresh(page);
    const btn = page.getByTestId('topbar-fps');
    await expect(btn).toHaveAttribute('data-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('data-pressed', 'true');
  });

  test('Share copies a URL; Collab mints a room and navigates', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoVaultFresh(page);

    // Collab should mint a room and navigate to /vault/room?id=mkv-xxx
    await page.getByTestId('topbar-collab').click();
    await page.waitForURL(/\/vault\/room\?id=mkv-[a-z0-9]+/i, { timeout: 15000 });
    await expect(page.getByTestId('topbar-leave')).toBeVisible();

    // Now Share in the room should copy that URL.
    await page.getByTestId('topbar-share').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/\/vault\/room\?id=mkv-[a-z0-9]+/i);
  });

  test('Leave returns from a room back to /vault', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/vault/room?id=mkv-leaveback');
    await expect(page.getByTestId('topbar-leave')).toBeVisible();
    await page.getByTestId('topbar-leave').click();
    await expect
      .poll(() => page.evaluate(() => window.location.pathname), {
        timeout: 30000,
        intervals: [500, 1000, 2000],
      })
      .toBe('/vault');
    await expect(page.getByTestId('topbar-collab')).toBeVisible({ timeout: 15000 });
  });
});
