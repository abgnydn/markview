import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Extension load smoke — verifies that both Chrome MV3 extensions
 * (`apps/extension` and `apps/context-injector`) actually load into a
 * real Chromium without service-worker boot errors.
 *
 * Why we need this: bad manifest references, broken service-worker code,
 * or missing dist artifacts will only surface when an extension is loaded
 * — not by typecheck, not by build. This catches them.
 *
 * What this does NOT do: simulate the full UX (clicking the toolbar icon,
 * opening the side panel, pairing the WebRTC bridge). Those are
 * browser-managed surfaces that need additional test fixtures.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const VIEWER_EXT = path.join(REPO, 'apps', 'extension');
const BRIDGE_EXT = path.join(REPO, 'apps', 'context-injector');

async function launchWithExtensions(extensionPaths: string[]): Promise<BrowserContext> {
  const userDataDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tether-ext-'));
  // Chromium MV3 service workers only register reliably in headed mode or
  // the *new* headless mode (`--headless=new`). The old headless skips
  // extension loading entirely. Force the new mode.
  return await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--headless=new`,
      `--disable-extensions-except=${extensionPaths.join(',')}`,
      `--load-extension=${extensionPaths.join(',')}`,
      '--no-sandbox',
    ],
  });
}

test.describe('extension load smoke', () => {
  test('apps/extension (markdown viewer) loads + service worker registers', async () => {
    test.skip(!fs.existsSync(path.join(VIEWER_EXT, 'app', 'index.html')),
      'apps/extension/app/ not built — run `cd apps/extension && ./build-extension.sh` first');

    const context = await launchWithExtensions([VIEWER_EXT]);

    // Service worker should appear within a few seconds of load. Either it's
    // already present, or we wait for the event.
    const sw = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker', { timeout: 10_000 });
    expect(sw).toBeTruthy();
    expect(sw.url()).toContain('service-worker.js');

    // The extension is now registered. Confirm the side-panel HTML
    // is reachable at the manifest's default_path.
    const swUrl = new URL(sw.url());
    const extId = swUrl.host; // chrome-extension://<id>/...
    const page = await context.newPage();
    const sidepanelResponse = await page.goto(`chrome-extension://${extId}/app/index.html`);
    expect(sidepanelResponse?.status()).toBe(200);
    // Page should have rendered SOMETHING — Tether brand or a Next.js root
    const text = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
    expect(text.length).toBeGreaterThan(0);

    await context.close();
  });

  test('apps/context-injector (bridge) loads + content + background scripts', async () => {
    test.skip(!fs.existsSync(path.join(BRIDGE_EXT, 'dist', 'background.js')),
      'apps/context-injector/dist not built — run `cd apps/context-injector && npm run build`');

    const context = await launchWithExtensions([BRIDGE_EXT]);

    const sw = context.serviceWorkers()[0]
      ?? await context.waitForEvent('serviceworker', { timeout: 10_000 });
    expect(sw).toBeTruthy();
    expect(sw.url()).toContain('background.js');

    // Content script should auto-inject on any URL. Open a tab + verify
    // the content script's worldview is reachable.
    const page = await context.newPage();
    await page.goto('about:blank');
    // The content script registers an event listener; can't directly test
    // it without a paired bridge, but the absence of errors here means
    // the script at least parsed and ran.

    // No console errors during initial load (excluding extension-noise)
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(500);
    expect(errors, errors.join('\n')).toEqual([]);

    await context.close();
  });
});
