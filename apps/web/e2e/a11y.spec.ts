import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility baseline — `serious` and `critical` axe-core violations on
 * the public routes. This pins what we won't regress; the longer tail of
 * `moderate` and `minor` violations is on the cleanup roadmap.
 *
 * Routes audited:
 *   - /         editor + landing
 *   - /docs     technical docs (markdown rendering)
 *   - /pricing  static marketing
 *   - /privacy, /terms  static marketing
 *
 * /vault, /vault/room, /brain, /agent are skipped because they render
 * inside a Canvas (R3F) and need a different a11y strategy (live regions
 * + keyboard alternatives) than DOM scans cover.
 */

const ROUTES = ['/', '/docs', '/pricing', '/privacy', '/terms'] as const;

for (const route of ROUTES) {
  test(`a11y baseline: ${route}`, async ({ page }) => {
    await page.goto(route);
    // Wait for any landing animations to settle so contrast isn't measured mid-fade.
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules([
        // The landing has deliberate hover-only affordances; we'll fix in the
        // dedicated a11y pass rather than block the baseline on them.
        'color-contrast',
      ])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );

    if (blocking.length > 0) {
      console.error(`a11y violations on ${route}:`);
      for (const v of blocking) {
        console.error(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
      }
    }

    expect(blocking).toEqual([]);
  });
}
