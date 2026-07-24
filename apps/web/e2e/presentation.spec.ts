import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';

// Golden path: markdown in → correct deck out. Pins the slide-splitting
// contract (see src/lib/markdown/slide-split.ts) end-to-end so the most
// common authoring conventions can't silently regress into a broken deck.
//
// Flow mirrors a real first session: land → "Open editor" → drag-drop a
// .md into the viewer → open the file → present.

async function openWithMarkdown(page: Page, filename: string, content: string, expectText: string) {
  await page.locator('.ed-cta-primary').click();
  await page.waitForSelector('.viewer-layout', { timeout: 10000 });

  // Simulate dropping a .md file onto the viewer (the supported ingest
  // path). Retried: addFiles no-ops silently if the drop lands before the
  // fresh workspace's activeWorkspaceId commits, so drop again until the
  // file actually shows up in the store-rendered file list.
  const item = page.locator(`.sidebar-item[title="${filename}"]`).first();
  await expect(async () => {
    await page.evaluate(({ name, md }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([md], name, { type: 'text/markdown' }));
      const target = document.querySelector('.viewer-layout');
      target?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, { name: filename, md: content });
    await expect(item).toBeAttached({ timeout: 2500 });
  }).toPass({ timeout: 20000 });

  // Dropped files aren't auto-activated. On desktop the sidebar is
  // hover-revealed (zen.css: .zen-zone-left:hover / .sidebar:hover) —
  // hover the left edge zone and click the file like a real user. The
  // click can race the slide-in transition, so retry hover→click until
  // the document actually renders. Generous budget: cold sessions also
  // initialize Shiki/Mermaid before the new doc appears.
  await expect(async () => {
    await page.hover('.zen-zone-left');
    await item.click({ timeout: 5000 });
    await expect(page.locator('.markdown-content').first()).toContainText(expectText, { timeout: 5000 });
  }).toPass({ timeout: 45000 });
}

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
    await openWithMarkdown(page, 'deck.md', '# One\n\nalpha\n\n## Two\n\nbeta\n\n## Three\n\ngamma\n', 'alpha');
    await openPresentation(page);

    await expect(page.locator('.presentation-counter')).toHaveText('1/3');
    const slide = page.locator('.presentation-stage .presentation-slide');
    await expect(slide.locator('h1')).toHaveText('One');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.presentation-counter')).toHaveText('2/3');
    await expect(slide.locator('h2')).toHaveText('Two');
  });

  test('--- separated markdown without headings becomes one slide per rule', async ({ page }) => {
    await openWithMarkdown(page, 'hr-deck.md', 'first\n\n---\n\nsecond\n\n---\n\nthird\n', 'first');
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
    await openWithMarkdown(page, 'lead.md', 'intro line\n\n# Title\n\nbody\n\n# Next\n\nmore\n', 'intro line');
    await openPresentation(page);

    await expect(page.locator('.presentation-counter')).toHaveText('1/2');
    const slide = page.locator('.presentation-stage .presentation-slide');
    await expect(slide.locator('h1')).toHaveText('Title');
    await expect(slide).toContainText('intro line');
  });
});
