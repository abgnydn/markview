import { test, expect, Page } from '@playwright/test';

// These tests drive canvas-panel interaction via the dev-only
// window.__vaultTest hook exposed by VaultExperience. This lets us exercise
// the "select doc → modal opens" path without trying to raycast pixels.

interface TestAPI {
  getDocs(): Array<{ id: string; title: string; tint: string }>;
  getActiveId(): string | null;
  create(): void;
  selectById(id: string): void;
  selectByIndex(i: number): void;
  clearActive(): void;
}

declare global {
  interface Window {
    __vaultTest?: TestAPI;
  }
}

async function gotoVaultFresh(page: Page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/vault');
  await expect(page.locator('canvas').first()).toBeVisible();
  // Wait for the dev-only hook to attach.
  await page
    .waitForFunction(() => !!(window as Window).__vaultTest, null, { timeout: 5000 })
    .catch(() => {
      throw new Error(
        'window.__vaultTest was not installed — run tests with NODE_ENV!=production.',
      );
    });
}

test.describe('vault · canvas interactions', () => {
  test('seed docs are present and carry stable shape', async ({ page }) => {
    await gotoVaultFresh(page);
    const docs = await page.evaluate(() => window.__vaultTest!.getDocs());
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) {
      expect(d.id).toBeTruthy();
      expect(d.title).toMatch(/\.md$/);
      expect(['cyan', 'violet', 'amber']).toContain(d.tint);
    }
  });

  test('selectByIndex opens the modal with the right doc title', async ({ page }) => {
    await gotoVaultFresh(page);
    const firstTitle = await page.evaluate(
      () => window.__vaultTest!.getDocs()[0].title,
    );
    await page.evaluate(() => window.__vaultTest!.selectByIndex(0));
    // Modal renders with the doc title in its header.
    await expect(page.locator(`[role="dialog"]`).first()).toBeVisible();
    await expect(page.locator(`[role="dialog"]`).first()).toContainText(firstTitle);
  });

  test('Esc closes the modal', async ({ page }) => {
    await gotoVaultFresh(page);
    await page.evaluate(() => window.__vaultTest!.selectByIndex(0));
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    const active = await page.evaluate(() => window.__vaultTest!.getActiveId());
    expect(active).toBeNull();
  });

  test('create() appends a new doc and selects it', async ({ page }) => {
    await gotoVaultFresh(page);
    const beforeCount = await page.evaluate(
      () => window.__vaultTest!.getDocs().length,
    );
    await page.evaluate(() => window.__vaultTest!.create());
    await expect
      .poll(() =>
        page.evaluate(() => window.__vaultTest!.getDocs().length),
      )
      .toBe(beforeCount + 1);
    const active = await page.evaluate(() => window.__vaultTest!.getActiveId());
    const docs = await page.evaluate(() => window.__vaultTest!.getDocs());
    // Newest doc should be the active one (create sets activeId).
    expect(active).toBe(docs[docs.length - 1].id);
  });

  test('selectById on unknown id clears to null without crashing', async ({ page }) => {
    await gotoVaultFresh(page);
    await page.evaluate(() => window.__vaultTest!.selectById('does-not-exist'));
    // Modal should not appear — no doc matches.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });

  test('clearActive closes whatever is open', async ({ page }) => {
    await gotoVaultFresh(page);
    await page.evaluate(() => window.__vaultTest!.selectByIndex(0));
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
    await page.evaluate(() => window.__vaultTest!.clearActive());
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });
});
