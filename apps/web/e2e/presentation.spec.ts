import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { openWithFiles } from './helpers';

// Golden path: markdown in → correct deck out. Pins the slide-splitting
// contract (see src/lib/markdown/slide-split.ts) end-to-end so the most
// common authoring conventions can't silently regress into a broken deck.
//
// Flow mirrors a real first session: land → "Open editor" → drag-drop a
// .md into the viewer → open the file → present.

async function openPresentation(page: Page) {
  // The toolbar is hover-revealed via the top edge zone (zen.css).
  await page.hover('.zen-zone-top');
  const presBtn = page.locator('button[title="Presentation mode (P)"]');
  await expect(presBtn).toBeVisible();
  await presBtn.click();
  await expect(page.locator('.presentation-overlay')).toBeVisible({ timeout: 5000 });
}

test.describe('presentation golden path', () => {
  // Cold sessions compile Shiki/Mermaid WASM on the main thread before the
  // first render — the default 30s test timeout is not enough for that.
  test.beforeEach(() => test.setTimeout(120_000));

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('heading-structured markdown becomes one slide per h1/h2', async ({ page }) => {
    await openWithFiles(page, [{ name: 'deck.md', content: '# One\n\nalpha\n\n## Two\n\nbeta\n\n## Three\n\ngamma\n' }]);
    await openPresentation(page);

    await expect(page.locator('.presentation-counter')).toHaveText('1/3');
    const slide = page.locator('.presentation-stage .presentation-slide');
    await expect(slide.locator('h1')).toHaveText('One');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.presentation-counter')).toHaveText('2/3');
    await expect(slide.locator('h2')).toHaveText('Two');
  });

  test('--- separated markdown without headings becomes one slide per rule', async ({ page }) => {
    await openWithFiles(page, [{ name: 'hr-deck.md', content: 'first\n\n---\n\nsecond\n\n---\n\nthird\n' }]);
    await openPresentation(page);

    await expect(page.locator('.presentation-counter')).toHaveText('1/3');
    const slide = page.locator('.presentation-stage .presentation-slide');
    await expect(slide).toContainText('first');
    // The rule is a separator, not slide content
    await expect(slide.locator('hr')).toHaveCount(0);

    await page.keyboard.press('ArrowRight');
    await expect(slide).toContainText('second');
  });

  test('lead content before the first heading stays on that heading\'s slide', async ({ page }) => {
    await openWithFiles(page, [{ name: 'lead.md', content: 'intro line\n\n# Title\n\nbody\n\n# Next\n\nmore\n' }]);
    await openPresentation(page);

    await expect(page.locator('.presentation-counter')).toHaveText('1/2');
    const slide = page.locator('.presentation-stage .presentation-slide');
    await expect(slide.locator('h1')).toHaveText('Title');
    await expect(slide).toContainText('intro line');
  });
});
