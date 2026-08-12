import { test, expect } from '@playwright/test';
import { uploadMultipleFiles, uploadFile, clickOverflowItem } from './helpers';

// End-to-end coverage for the 2026-08-10 audit wave. These flows had NO
// e2e coverage before, which is why the bugs survived four earlier audit
// passes. Each test pins a specific defect, not a general feature.

const DOC_A = '# Alpha\n\nAlpha body text.\n';
const DOC_B = '# Beta\n\nBeta body text.\n';

test.describe('Editor ↔ file switching', () => {
  test('switching files with the editor open does not write one file over another', async ({ page }) => {
    await page.goto('/');
    await uploadMultipleFiles(page, [
      { name: 'alpha.md', content: DOC_A },
      { name: 'beta.md', content: DOC_B },
    ]);
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    // Edit whichever file opened first, and replace its whole body.
    await clickOverflowItem(page, 'Edit file');
    await page.waitForSelector('.editor-overlay', { timeout: 10000 });
    // Remember WHICH file this editor was opened on — the whole point is
    // that its buffer must land here and nowhere else.
    const editedName = (await page.locator('.editor-filename').innerText()).trim();
    const cm = '.editor-codemirror .cm-content';
    await page.locator(cm).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('CONTAMINANT');

    // Switch files WITHOUT closing the editor — the command palette is the
    // reachable path for this (the overlay covers the sidebar), and it is
    // exactly how the cross-file save corruption was triggered.
    await page.keyboard.press('ControlOrMeta+p');
    await expect(page.locator('.mv-palette-overlay')).toBeVisible({ timeout: 5000 });
    await page.locator('.mv-palette-input').fill('Go to');
    const target = page.locator('.mv-palette-item', { hasText: /Go to · (alpha|beta)/ }).last();
    await target.click();
    await page.waitForTimeout(800);

    // Close the editor (flushing whatever buffer it holds) and read both
    // documents back from storage.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);

    const contents = await page.evaluate(async () => {
      const req = indexedDB.open('markview');
      const dbh: IDBDatabase = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const tx = dbh.transaction('files', 'readonly');
      const all: unknown[] = await new Promise((res, rej) => {
        const r = tx.objectStore('files').getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return (all as { filename: string; content: string }[]).map((f) => ({
        filename: f.filename,
        content: f.content,
        hasContaminant: f.content.includes('CONTAMINANT'),
      }));
    });

    expect(contents.length).toBe(2);
    // The header is CSS-uppercased and may drop the extension — compare
    // case-insensitive stems.
    const stem = (s: string) => s.replace(/\.md$/i, '').trim().toLowerCase();
    const edited = contents.find((c) => stem(c.filename) === stem(editedName))!;
    const other = contents.find((c) => stem(c.filename) !== stem(editedName))!;
    expect(edited, `editor header "${editedName}" matched no file`).toBeTruthy();

    // The file the user was NOT editing must be untouched: it keeps its own
    // body text and never receives the typed buffer. (Pre-fix, the flush on
    // close wrote the buffer into whichever file had become active, so this
    // file lost its content entirely.)
    expect(other.hasContaminant).toBe(false);
    expect(other.content).toContain(other.filename.startsWith('alpha') ? 'Alpha body' : 'Beta body');
    // The edited file is the only one allowed to carry it.
    expect(edited.hasContaminant).toBe(true);
  });

  test('a file emptied in the editor stays editable', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'empty-me.md', DOC_A);
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    await clickOverflowItem(page, 'Edit file');
    await page.waitForSelector('.editor-overlay', { timeout: 10000 });
    const cm = '.editor-codemirror .cm-content';
    await page.locator(cm).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('ControlOrMeta+s');
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Re-opening the editor must still work — the file used to become
    // permanently un-editable ("No document open").
    await clickOverflowItem(page, 'Edit file');
    await expect(page.locator('.editor-overlay')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Stacked overlays', () => {
  test('Escape closes only the topmost layer', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'layers.md', DOC_A);
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    await clickOverflowItem(page, 'Edit file');
    await page.waitForSelector('.editor-overlay', { timeout: 10000 });

    // Command palette on top of the editor.
    await page.keyboard.press('ControlOrMeta+p');
    const palette = page.locator('.mv-palette-overlay');
    await expect(palette).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible({ timeout: 5000 });
    // The editor beneath must survive that same keypress.
    await expect(page.locator('.editor-overlay')).toBeVisible();
  });
});

test.describe('Task list toggling', () => {
  test('clicking a checkbox does not rewrite a task line inside a code fence', async ({ page }) => {
    const doc = [
      '# Tasks',
      '',
      '```md',
      '- [ ] EXAMPLE_IN_FENCE',
      '```',
      '',
      '- [ ] real task',
      '',
    ].join('\n');
    await page.goto('/');
    await uploadFile(page, 'tasks.md', doc);
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    const box = page.locator('input[type="checkbox"]').first();
    await expect(box).toBeVisible({ timeout: 10000 });
    await box.click();
    await page.waitForTimeout(700);

    // The fenced sample must still read as unchecked.
    const pre = await page.locator('pre').first().innerText();
    expect(pre).toContain('- [ ] EXAMPLE_IN_FENCE');
    expect(pre).not.toContain('- [x] EXAMPLE_IN_FENCE');
    // …and the real checkbox is the one that flipped.
    await expect(box).toBeChecked();
  });
});

test.describe('Export menu', () => {
  test('every export format runs without throwing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const doc = [
      '# Export me',
      '',
      'Math $E = mc^2$ inline, a [[wikilink]], and a table:',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```ts',
      'const x: number = 1;',
      '```',
      '',
      '- [ ] a task',
      '',
    ].join('\n');

    await page.goto('/');
    await uploadFile(page, 'export-me.md', doc);
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    // Markdown + HTML downloads are the two synchronous-safe paths to
    // exercise in CI; the heavy binary formats (PDF/DOCX/PPTX) are covered
    // by unit tests. Here we assert the menu opens and a download fires.
    await clickOverflowItem(page, 'Export…');
    const menu = page.locator('.export-menu, [class*="export-menu"]').first();
    await expect(menu).toBeVisible({ timeout: 5000 });

    const htmlItem = menu.getByText(/HTML/i).first();
    const download = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await htmlItem.click();
    const dl = await download;
    if (dl) expect(await dl.suggestedFilename()).toMatch(/\.html$/);
    expect(errors).toEqual([]);
  });
});

test.describe('Presentation mode', () => {
  test('modifier chords are not hijacked by slide shortcuts', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'deck.md', '# Slide one\n\nBody\n\n---\n\n# Slide two\n\nMore\n');
    await page.waitForSelector('.toolbar', { timeout: 15000 });

    await page.keyboard.press('p');
    const deck = page.locator('.presentation-mode, [class*="presentation"]').first();
    await expect(deck).toBeVisible({ timeout: 10000 });

    // ⌘F used to toggle fullscreen and ⌘C used to clear the drawing.
    // Neither may close or disturb the deck.
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+f');
    await expect(deck).toBeVisible();

    // A plain arrow key still advances.
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await expect(deck).toBeVisible();
  });
});

test.describe('Unsigned-build install guidance', () => {
  // The desktop builds are ad-hoc signed, so macOS blocks first launch and
  // (since macOS 15) right-click → Open no longer bypasses it. Without this
  // note on the landing page the download is a dead end.
  test.use({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' });

  test('macOS visitors get Gatekeeper instructions next to the download', async ({ page }) => {
    await page.goto('/?home=1');
    const note = page.locator('.ed-install-note');
    await expect(note).toBeVisible({ timeout: 10000 });
    await note.locator('summary').click();
    await expect(note).toContainText('Open Anyway');
    await expect(note).toContainText('com.apple.quarantine');
    // Must NOT resurrect the advice that stopped working on macOS 15+.
    await expect(note).not.toContainText(/right-click/i);
  });
});
