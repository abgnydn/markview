import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function uploadFile(page: Page, filename: string, content: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-sec-'));
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

test.describe('XSS Prevention', () => {
  test('blocks <script> tag execution', async ({ page }) => {
    await page.goto('/');

    let dialogTriggered = false;
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await uploadFile(page, 'xss.md', '# Test\n\n<script>alert("XSS")</script>\n\nSafe content.');
    await page.waitForTimeout(1000);
    expect(dialogTriggered).toBe(false);

    const scripts = await page.locator('.markdown-content script').count();
    expect(scripts).toBe(0);
  });

  test('blocks onerror event handler', async ({ page }) => {
    await page.goto('/');

    let dialogTriggered = false;
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await uploadFile(page, 'xss-img.md', '# Test\n\n<img onerror="alert(1)" src="x">\n\nAfter image.');
    await page.waitForTimeout(1000);
    expect(dialogTriggered).toBe(false);

    const imgWithHandler = await page.locator('.markdown-content img[onerror]').count();
    expect(imgWithHandler).toBe(0);
  });

  test('blocks onclick event handler', async ({ page }) => {
    await page.goto('/');

    let dialogTriggered = false;
    page.on('dialog', async (dialog) => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await uploadFile(page, 'xss-click.md', '# Test\n\n<div onclick="alert(1)">Click me</div>');
    await page.waitForTimeout(1000);
    expect(dialogTriggered).toBe(false);

    const divWithHandler = await page.locator('.markdown-content [onclick]').count();
    expect(divWithHandler).toBe(0);
  });

  test('blocks <iframe> injection', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'xss-iframe.md', '# Test\n\n<iframe src="https://evil.com"></iframe>');

    const iframes = await page.locator('.markdown-content iframe').count();
    expect(iframes).toBe(0);
  });

  test('blocks <style> injection', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'xss-style.md', '# Test\n\n<style>body{display:none}</style>');

    const styles = await page.locator('.markdown-content style').count();
    expect(styles).toBe(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('blocks <form> injection', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'xss-form.md', '# Test\n\n<form action="https://evil.com"><input type="text"></form>');

    const forms = await page.locator('.markdown-content form').count();
    expect(forms).toBe(0);
  });

  test('blocks javascript: URLs in links', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'xss-jsurl.md', '# Test\n\n<a href="javascript:alert(1)">Click</a>');

    const jsLinks = await page.locator('.markdown-content a[href^="javascript"]').count();
    expect(jsLinks).toBe(0);
  });

  test('preserves safe HTML after sanitization', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'safe.md', '# Safe\n\n**Bold** and *italic* and `code` are all safe.');

    await page.waitForSelector('.markdown-content', { timeout: 10000 });
    await expect(page.locator('.markdown-content strong').first()).toContainText('Bold');
    await expect(page.locator('.markdown-content em').first()).toContainText('italic');
  });
});

test.describe('Export', () => {
  test('export menu opens from toolbar', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'export-test.md', '# Export Test\n\nSome content.');

    const exportContainer = page.locator('.export-menu-container');
    await expect(exportContainer).toBeVisible();
    // Click the export button inside the container
    await exportContainer.locator('.toolbar-btn').click();
    // Menu items should appear
    await expect(page.locator('.export-dropdown')).toBeVisible({ timeout: 3000 });
  });
});
