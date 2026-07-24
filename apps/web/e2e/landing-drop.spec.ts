import { test, expect } from '@playwright/test';

// The landing hero promises "drag-drop a .md to start". Pin that the
// promise is real: dropping a markdown file on the landing seeds a
// workspace and lands the user in the viewer with that document rendered.

test.describe('landing drag-drop', () => {
  test.beforeEach(() => test.setTimeout(120_000));

  test('dropping a .md on the landing opens it in the viewer', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ed-landing', { timeout: 10000 });

    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['# Dropped Doc\n\ndropped-marker\n'], 'dropped.md', { type: 'text/markdown' }));
      const target = document.querySelector('.ed-landing');
      target?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });

    await page.waitForSelector('.viewer-layout', { timeout: 15000 });
    await expect(page.locator('.markdown-content').first()).toContainText('dropped-marker', { timeout: 60000 });
  });

  test('non-markdown drops are ignored and stay on the landing', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ed-landing', { timeout: 10000 });

    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['not markdown'], 'photo.png', { type: 'image/png' }));
      const target = document.querySelector('.ed-landing');
      target?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });

    // Give any (incorrect) navigation a moment to happen, then assert none did.
    await page.waitForTimeout(1500);
    await expect(page.locator('.ed-landing')).toBeVisible();
  });
});
