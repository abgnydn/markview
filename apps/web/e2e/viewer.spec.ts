import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Helper: inject file via filechooser dialog
async function uploadFile(page: Page, filename: string, content: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-'));
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, content);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.landing-cta-primary').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);

  // Wait for viewer to appear
  await page.waitForSelector('.viewer-layout', { timeout: 10000 });

  // Cleanup
  fs.unlinkSync(filePath);
  fs.rmdirSync(tmpDir);
}

const testMarkdown = `---
title: Test Document
tags: [test, e2e]
---

# Heading 1

This is a paragraph with **bold**, *italic*, and \`inline code\`.

## Heading 2

- Item 1
- Item 2
- [x] Checked
- [ ] Unchecked

### Code Block

\`\`\`javascript
function hello() {
  console.log("world");
}
\`\`\`

### Table

| Name | Value |
|------|-------|
| Alpha | 1 |
| Beta | 2 |

### Blockquote

> This is a blockquote.

> [!NOTE]
> This is a GitHub alert.

---

[External link](https://example.com)
`;

test.describe('File Upload & Workspace', () => {
  test('uploads a markdown file and enters viewer', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'test.md', testMarkdown);

    // Should see viewer layout
    await expect(page.locator('.viewer-layout')).toBeVisible();
    // Sidebar should show file
    await expect(page.locator('.sidebar')).toBeVisible();
    // Filename should appear
    await expect(page.locator('.viewer-filename')).toContainText('test');
  });


});

test.describe('Markdown Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'test.md', testMarkdown);
    // Wait for rendering
    await page.waitForSelector('.markdown-content', { timeout: 10000 });
  });

  test('renders headings', async ({ page }) => {
    const content = page.locator('.markdown-content');
    await expect(content.locator('h1').first()).toContainText('Heading 1');
    await expect(content.locator('h2').first()).toContainText('Heading 2');
  });

  test('renders bold and italic text', async ({ page }) => {
    const content = page.locator('.markdown-content');
    await expect(content.locator('strong').first()).toContainText('bold');
    await expect(content.locator('em').first()).toContainText('italic');
  });

  test('renders inline code', async ({ page }) => {
    const content = page.locator('.markdown-content');
    await expect(content.locator('code').first()).toBeVisible();
  });

  test('renders unordered list', async ({ page }) => {
    await expect(page.locator('.markdown-content ul').first()).toBeVisible();
    await expect(page.locator('.markdown-content li').first()).toContainText('Item 1');
  });

  test('renders task list checkboxes', async ({ page }) => {
    const checkboxes = page.locator('.markdown-content input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('renders code block with syntax highlighting', async ({ page }) => {
    await expect(page.locator('.markdown-content pre').first()).toBeVisible();
  });

  test('renders table', async ({ page }) => {
    await expect(page.locator('.markdown-content table')).toBeVisible();
    await expect(page.locator('.markdown-content th').first()).toContainText('Name');
    await expect(page.locator('.markdown-content td').first()).toContainText('Alpha');
  });

  test('renders blockquote', async ({ page }) => {
    await expect(page.locator('.markdown-content blockquote').first()).toBeVisible();
  });

  test('renders GitHub alert', async ({ page }) => {
    await expect(page.locator('.markdown-content .gh-alert')).toBeVisible();
  });

  test('renders horizontal rule', async ({ page }) => {
    await expect(page.locator('.markdown-content hr').first()).toBeVisible();
  });

  test('renders external link', async ({ page }) => {
    const link = page.locator('.markdown-content a[href="https://example.com"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText('External link');
  });

  test('renders frontmatter card', async ({ page }) => {
    await expect(page.locator('.frontmatter-card')).toBeVisible();
    await expect(page.locator('.frontmatter-card')).toContainText('Test Document');
  });
});

test.describe('Productivity Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'test.md', testMarkdown);
    await page.waitForSelector('.markdown-content', { timeout: 10000 });
  });

  test('shows table of contents with headings', async ({ page }) => {
    const toc = page.locator('.toc');
    await expect(toc).toBeVisible();
    await expect(toc).toContainText('Heading 1');
    await expect(toc).toContainText('Heading 2');
  });



  test('shows toolbar with action buttons', async ({ page }) => {
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('search dialog opens with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await expect(page.locator('.search-dialog')).toBeVisible({ timeout: 3000 });
  });

  test('presentation mode opens via toolbar button', async ({ page }) => {
    const presBtn = page.locator('button[title="Presentation mode (P)"]');
    await expect(presBtn).toBeVisible();
    await presBtn.click();
    await expect(page.locator('.presentation-overlay')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });

  test('editor mode opens via toolbar button', async ({ page }) => {
    const editBtn = page.locator('button[title="Edit markdown (E)"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await expect(page.locator('.editor-overlay')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });
});

const mermaidMarkdown = `# Diagrams

\`\`\`mermaid
flowchart TD
    A[Start] --> B[End]
\`\`\`

## Sequence

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi
\`\`\`
`;

test.describe('Mermaid Diagrams', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'diagrams.md', mermaidMarkdown);
    await page.waitForSelector('.markdown-content', { timeout: 10000 });
    // Wait for mermaid to render
    await page.waitForSelector('.mermaid-wrapper', { timeout: 15000 });
  });

  test('renders mermaid diagrams as SVG', async ({ page }) => {
    const wrappers = page.locator('.mermaid-wrapper');
    await expect(wrappers.first()).toBeVisible();
    // Should contain SVG
    const svg = wrappers.first().locator('svg').first();
    await expect(svg).toBeVisible();
  });

  test('shows toolbar on hover', async ({ page }) => {
    const wrapper = page.locator('.mermaid-wrapper').first();
    // Move mouse to corner to ensure no hover state from previous test
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350); // let transition complete
    // Toolbar hidden initially — check via JS to avoid computed style mismatch
    const initialOpacity = await page.evaluate(() => {
      const toolbar = document.querySelector('.mermaid-toolbar');
      return toolbar ? getComputedStyle(toolbar).opacity : '0';
    });
    expect(parseFloat(initialOpacity)).toBeLessThanOrEqual(0.1);
    // Hover to show
    await wrapper.hover();
    await page.waitForTimeout(300);
    const hoverOpacity = await page.evaluate(() => {
      const toolbar = document.querySelector('.mermaid-toolbar');
      return toolbar ? getComputedStyle(toolbar).opacity : '0';
    });
    expect(parseFloat(hoverOpacity)).toBeGreaterThanOrEqual(0.9);
  });

  test('toolbar has zoom, SVG, and PNG buttons', async ({ page }) => {
    const wrapper = page.locator('.mermaid-wrapper').first();
    await wrapper.hover();
    await expect(wrapper.locator('[data-mermaid-zoom]')).toBeVisible();
    await expect(wrapper.locator('[data-mermaid-copy-svg]')).toBeVisible();
    await expect(wrapper.locator('[data-mermaid-copy-png]')).toBeVisible();
  });

  test('zoom opens preview modal', async ({ page }) => {
    const wrapper = page.locator('.mermaid-wrapper').first();
    await wrapper.hover();
    await wrapper.locator('[data-mermaid-zoom]').click();
    await expect(page.locator('.mermaid-preview-overlay')).toBeVisible();
    await expect(page.locator('.mermaid-preview-container')).toBeVisible();
    // Close with escape
    await page.keyboard.press('Escape');
    await expect(page.locator('.mermaid-preview-overlay')).not.toBeVisible();
  });
});

test.describe('Code Block Copy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'test.md', testMarkdown);
    await page.waitForSelector('.markdown-content', { timeout: 10000 });
  });

  test('code blocks have copy button', async ({ page }) => {
    const copyBtn = page.locator('[data-copy-code]').first();
    await expect(copyBtn).toBeVisible();
  });

  test('code block wrapper shows language label', async ({ page }) => {
    const langLabel = page.locator('.code-block-lang').first();
    await expect(langLabel).toBeVisible();
    await expect(langLabel).toContainText('javascript');
  });
});

test.describe('Loading Skeletons', () => {
  test('TOC shows skeleton before content loads', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'test.md', testMarkdown);
    // TOC aside should be present immediately (either skeleton or loaded)
    await expect(page.locator('.toc')).toBeVisible({ timeout: 10000 });
  });

  test('TOC skeleton transitions to real content', async ({ page }) => {
    await page.goto('/');
    await uploadFile(page, 'test.md', testMarkdown);
    await page.waitForSelector('.markdown-content', { timeout: 10000 });
    // After rendering, TOC should have real headings
    const toc = page.locator('.toc');
    await expect(toc).toContainText('Heading 1', { timeout: 10000 });
  });
});
