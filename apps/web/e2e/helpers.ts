import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// ─── Shared e2e helpers ──────────────────────────────────────────────────────
//
// Boot flow matching the CURRENT app (post landing rewrite): "Open editor"
// → drag-drop .md file(s) into the viewer → activate via the hover-revealed
// sidebar. The old suite's filechooser helper died with `.landing-cta-primary`.
//
// Known races handled here (see presentation.spec.ts history):
//  - addFiles no-ops if a drop lands before activeWorkspaceId commits → retry
//  - the sidebar slide-in transition can eat the activation click → retry
//  - cold sessions compile Shiki/Mermaid WASM before first render → long waits

/** First renderable plain-text snippet of a markdown doc — used to detect
 *  that THIS document (not the showcase/welcome doc) finished rendering.
 *  Skips frontmatter, code fences, tables, and markup-only lines. */
export function renderMarker(content: string): string {
  const lines = content.split('\n');
  let inFence = false;
  let i = 0;
  // skip a leading frontmatter block
  if (lines[0]?.trim() === '---') {
    i = lines.findIndex((l, n) => n > 0 && l.trim() === '---') + 1 || 0;
  }
  for (; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const t = raw
      .replace(/^#+\s*/, '')          // headings
      .replace(/^>\s*/, '')           // blockquotes
      .replace(/^[-*+]\s+/, '')       // list bullets
      .replace(/^\d+\.\s+/, '')       // ordered lists
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
      .replace(/[*_`~]/g, '')         // inline markup
      .trim();
    if (t.length >= 3 && !/^[|:\-\s0-9.<>!\[\]]+$/.test(t) && !/^</.test(t)) {
      return t.slice(0, 40);
    }
  }
  return '';
}

/** Boot the viewer by dropping `files` on the LANDING — this seeds a
 *  workspace containing exactly those files (no showcase docs) and
 *  auto-activates the first one. Assumes the page is at `/` with no prior
 *  workspace. Waits for the first file to actually render. */
export async function openWithFiles(
  page: Page,
  files: { name: string; content: string }[],
) {
  await page.waitForSelector('.ed-landing', { timeout: 15000 });

  await page.evaluate((payload) => {
    const dt = new DataTransfer();
    for (const f of payload) dt.items.add(new File([f.content], f.name, { type: 'text/markdown' }));
    document.querySelector('.ed-landing')
      ?.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, files);

  await page.waitForSelector('.viewer-layout', { timeout: 15000 });
  // createWorkspace sorts files alphabetically and activates the first —
  // wait for THAT file's content, not the first in drop order.
  const first = [...files].sort((a, b) => a.name.localeCompare(b.name))[0];
  const marker = renderMarker(first.content);
  if (marker) {
    await expect(page.locator('.markdown-content').first()).toContainText(marker, { timeout: 60000 });
  }

  // Leave the toolbar revealed (cursor on the top edge zone): nearly every
  // test's next step is a toolbar interaction, and zen.css hides chrome
  // until its edge zone is hovered.
  await page.hover('.zen-zone-top');
}

/** Single-file convenience wrapper (drop-in for the old uploadFile). */
export async function uploadFile(page: Page, filename: string, content: string) {
  await openWithFiles(page, [{ name: filename, content }]);
}

/** Multi-file convenience wrapper (drop-in for the old uploadMultipleFiles). */
export async function uploadMultipleFiles(page: Page, files: { name: string; content: string }[]) {
  await openWithFiles(page, files);
}

/** Toolbar buttons hide until the top edge zone is hovered (zen.css) —
 *  hover first, then click by the button's `title` attribute. */
export async function clickToolbar(page: Page, title: string) {
  await page.hover('.zen-zone-top');
  const btn = page.locator(`button[title="${title}"]`);
  await expect(btn).toBeVisible({ timeout: 5000 });
  await btn.click();
}

/** Reveal the hover-hidden sidebar and keep it open (cursor stays on it). */
export async function revealSidebar(page: Page) {
  await page.hover('.zen-zone-left');
  await page.waitForTimeout(350); // slide-in transition
}

/** Editor / split view / diff / file browser live in the "More actions" (⋮)
 *  overflow menu — open it and click an item by its label. */
export async function clickOverflowItem(page: Page, label: string) {
  await page.hover('.zen-zone-top');
  await page.locator('button[title="More actions"]').click();
  await page.locator('.toolbar-overflow-item', { hasText: label }).click();
}

/** The export menu is the overflow's "Export…" item (no standalone toolbar
 *  button anymore) — open it and wait for the dropdown. */
export async function openExportMenu(page: Page) {
  await clickOverflowItem(page, 'Export…');
  await expect(page.locator('.export-dropdown')).toBeVisible({ timeout: 3000 });
}
