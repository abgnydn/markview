import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders hero section with title and tagline', async ({ page }) => {
    await expect(page.locator('.landing-title')).toContainText('The markdown viewer');
    await expect(page.locator('.landing-title-accent')).toContainText('your docs deserve');
    await expect(page.locator('.landing-subtitle')).toContainText('Your files never leave the browser');
  });

  test('renders privacy badge', async ({ page }) => {
    await expect(page.locator('.landing-badge')).toContainText('Zero-account');
    await expect(page.locator('.landing-badge')).toContainText('Privacy-first');
    await expect(page.locator('.landing-badge')).toContainText('Offline-ready');
  });

  test('has Open Markdown Files button', async ({ page }) => {
    const btn = page.locator('.landing-cta-primary');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Open Markdown Files');
  });

  test('has Open Folder button', async ({ page }) => {
    const btn = page.locator('.landing-cta-secondary');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Open Folder');
  });

  test('has GitHub import input and button', async ({ page }) => {
    const input = page.locator('.landing-github-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', /github\.com/);

    const btn = page.locator('.landing-github-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Import');
    await expect(btn).toBeDisabled(); // disabled when input is empty
  });

  test('GitHub import button enables when URL is entered', async ({ page }) => {
    const input = page.locator('.landing-github-input');
    await input.fill('https://github.com/test/repo');
    const btn = page.locator('.landing-github-btn');
    await expect(btn).toBeEnabled();
  });

  test('renders feature cards', async ({ page }) => {
    const features = page.locator('.landing-feature-card');
    await expect(features.first()).toBeVisible();
    const count = await features.count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test('renders MCP section', async ({ page }) => {
    await expect(page.locator('.landing-mcp-section')).toBeVisible();
  });

  test('renders privacy section', async ({ page }) => {
    await expect(page.locator('text=Privacy-First')).toBeVisible();
  });
});
