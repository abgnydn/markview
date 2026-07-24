import { test, expect } from '@playwright/test';

// Landing = LandingEditor (components/landing/landing-editor.tsx), shown at
// `/` when no workspace exists. Selectors are the ed-* namespace; the old
// .landing-* suite predates the landing rewrite.

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ed-landing', { timeout: 10000 });
  });

  test('renders hero title and eyebrow', async ({ page }) => {
    await expect(page.locator('.ed-hero h1')).toContainText('A markdown editor that stays on your machine');
    await expect(page.locator('.ed-hero-eyebrow')).toContainText('markdown, reconsidered');
  });

  test('nav has brand and GitHub link', async ({ page }) => {
    await expect(page.locator('.ed-nav-name')).toHaveText('Markview');
    const gh = page.locator('.ed-nav-links a[href*="github.com/abgnydn/markview"]');
    await expect(gh).toBeVisible();
  });

  test('Open editor CTA enters the viewer with the showcase workspace', async ({ page }) => {
    test.setTimeout(120_000); // cold Shiki/Mermaid init before first render
    await page.locator('.ed-cta-primary').click();
    await page.waitForSelector('.viewer-layout', { timeout: 15000 });
    // Showcase seeds and renders its welcome doc.
    await expect(page.locator('.markdown-content').first()).toContainText('A markdown editor', { timeout: 60000 });
  });

  test('desktop download button points at the latest release', async ({ page }) => {
    const dl = page.locator('.ed-hero a[href*="/releases/latest"]').first();
    await expect(dl).toBeVisible();
    const href = await dl.getAttribute('href');
    // Either a direct asset (latest/download/...) or the releases page fallback.
    expect(href).toMatch(/releases\/latest/);
  });

  test('GitHub import gates the Import button on input', async ({ page }) => {
    const input = page.getByPlaceholder(/Paste GitHub URL/i);
    const importBtn = page.getByRole('button', { name: 'Import' });
    await expect(importBtn).toBeDisabled();
    await input.fill('github.com/abgnydn/markview');
    await expect(importBtn).toBeEnabled();
  });

  test('feature grid lists the core surfaces', async ({ page }) => {
    const articles = page.locator('.ed-landing article');
    await expect(articles.first()).toBeVisible();
    expect(await articles.count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('.ed-landing')).toContainText('GitHub-flavored');
  });

  test('keyboard hints are shown', async ({ page }) => {
    await expect(page.locator('.ed-landing')).toContainText('drag-drop a');
  });
});
