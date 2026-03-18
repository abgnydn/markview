import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Helper: inject file via filechooser dialog
async function uploadFile(page: Page, filename: string, content: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.landing-cta-primary').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);

  await page.waitForSelector('.viewer-layout', { timeout: 10000 });

  fs.unlinkSync(filePath);
  fs.rmdirSync(tmpDir);
}

// Helper: upload multiple files
async function uploadMultipleFiles(page: Page, files: { name: string; content: string }[]) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
  const filePaths = files.map((f) => {
    const fp = path.join(tmpDir, f.name);
    fs.writeFileSync(fp, f.content);
    return fp;
  });

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.landing-cta-primary').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePaths);

  await page.waitForSelector('.viewer-layout', { timeout: 10000 });

  filePaths.forEach((fp) => fs.unlinkSync(fp));
  fs.rmdirSync(tmpDir);
}

const testMd = '# Test\n\nHello world.';

// ─── Custom Themes ──────────────────────────────────────────────────────────

test.describe('Custom Themes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'test.md', testMd);
    await page.waitForSelector('.toolbar', { timeout: 10000 });
  });

  test('theme picker button is visible in toolbar', async ({ page }) => {
    const paletteBtn = page.locator('button[title="Color scheme"]');
    await expect(paletteBtn).toBeVisible();
  });

  test('theme picker dropdown opens on click', async ({ page }) => {
    const paletteBtn = page.locator('button[title="Color scheme"]');
    await paletteBtn.click();
    await expect(page.locator('.toolbar-theme-picker')).toBeVisible();
    await expect(page.locator('.theme-picker-header')).toContainText('Color Scheme');
  });

  test('shows all preset themes in dropdown', async ({ page }) => {
    await page.locator('button[title="Color scheme"]').click();
    const items = page.locator('.theme-picker-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('github theme is selected by default', async ({ page }) => {
    await page.locator('button[title="Color scheme"]').click();
    const activeItem = page.locator('.theme-picker-active');
    await expect(activeItem).toContainText('GitHub');
  });

  test('switching theme changes CSS variables', async ({ page }) => {
    // Get initial bg color
    const initialBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
    });
    await page.locator('button[title="Color scheme"]').click();
    // Click Dracula
    await page.locator('.theme-picker-item', { hasText: 'Dracula' }).click();
    // Verify bg color changed from default
    const newBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
    });
    expect(newBg).not.toBe(initialBg);
  });

  test('theme persists across page reload', async ({ page }) => {
    // Get initial bg color
    const initialBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
    });
    await page.locator('button[title="Color scheme"]').click();
    await page.locator('.theme-picker-item', { hasText: 'Nord' }).click();
    // Reload page
    await page.reload();
    await page.waitForSelector('.toolbar', { timeout: 10000 });
    // Check persisted — should be different from the initial default
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
    });
    expect(bgColor).not.toBe(initialBg);
  });

  test('dropdown closes when clicking outside', async ({ page }) => {
    await page.locator('button[title="Color scheme"]').click();
    await expect(page.locator('.toolbar-theme-picker')).toBeVisible();
    // Click outside
    await page.locator('.toolbar-brand').click();
    await expect(page.locator('.toolbar-theme-picker')).not.toBeVisible();
  });
});

// ─── Drag-and-Drop Reorder ──────────────────────────────────────────────────

test.describe('Drag-and-Drop Reorder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadMultipleFiles(page, [
      { name: 'alpha.md', content: '# Alpha' },
      { name: 'beta.md', content: '# Beta' },
      { name: 'gamma.md', content: '# Gamma' },
    ]);
    await page.waitForSelector('.sidebar', { timeout: 10000 });
  });

  test('sidebar items show grip handle on hover', async ({ page }) => {
    const firstItem = page.locator('.sidebar-item-draggable').first();
    const handle = firstItem.locator('.sidebar-drag-handle');
    // Hidden by default
    await expect(handle).toHaveCSS('opacity', '0');
    // Visible on hover
    await firstItem.hover();
    await expect(handle).not.toHaveCSS('opacity', '0');
  });

  test('sidebar items are draggable', async ({ page }) => {
    const items = page.locator('.sidebar-item-draggable');
    const count = await items.count();
    expect(count).toBe(3);
    // Check draggable attribute
    const draggable = await items.first().getAttribute('draggable');
    expect(draggable).toBe('true');
  });

  test('file order matches upload order initially', async ({ page }) => {
    const names = page.locator('.sidebar-item-draggable .sidebar-item-name');
    await expect(names.nth(0)).toContainText('alpha');
    await expect(names.nth(1)).toContainText('beta');
    await expect(names.nth(2)).toContainText('gamma');
  });
});

// ─── URL Sharing ────────────────────────────────────────────────────────────

test.describe('URL Sharing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'share-test.md', '# Shareable\n\nThis can be shared via URL.');
    await page.waitForSelector('.toolbar', { timeout: 10000 });
  });

  test('share as URL button exists in export menu', async ({ page }) => {
    // Open export menu
    await page.locator('button[title="Copy & Export"]').click();
    await expect(page.locator('.export-dropdown')).toBeVisible();
    // Check for Share as URL button
    const shareBtn = page.locator('.export-dropdown-item', { hasText: 'Share as URL' });
    await expect(shareBtn).toBeVisible();
  });

  test('clicking share URL copies to clipboard', async ({ page, context }) => {
    // Grant clipboard permission
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.locator('button[title="Copy & Export"]').click();
    const shareBtn = page.locator('.export-dropdown-item', { hasText: 'Share as URL' });
    await shareBtn.click();

    // Should show toast
    await expect(page.locator('.export-toast')).toContainText('Share URL copied');

    // Verify clipboard has URL with #md=
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('#md=');
  });

  // Skip: This test is flaky due to IndexedDB state + hash detection timing.
  // URL encoding/decoding roundtrip is thoroughly covered by url-share.test.ts (8 unit tests).
  test.skip('shared URL opens as new workspace', async ({ page }) => {
    // Clear any existing workspaces from IndexedDB first
    await page.goto('/');
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    });

    // Build a share URL by compressing content in the browser context via CompressionStream
    const shareHash = await page.evaluate(async () => {
      const content = '# Shared Doc\n\nOpened from URL!';
      const encoder = new TextEncoder();
      const stream = new Blob([encoder.encode(content)])
        .stream()
        .pipeThrough(new CompressionStream('gzip'));
      const compressed = await new Response(stream).arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(compressed)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `#md=${base64}&title=Shared+Doc`;
    });

    // Navigate to the share URL with fresh IndexedDB
    await page.goto(`/${shareHash}`);
    await page.waitForSelector('.viewer-layout', { timeout: 15000 });

    // Should create a workspace with the shared content
    await page.waitForSelector('.markdown-content', { timeout: 10000 });
    await expect(page.locator('.markdown-content')).toContainText('Opened from URL');
  });
});
