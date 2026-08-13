// The sanitize schema is the security boundary CLAUDE.md names: user
// markdown must never achieve script execution or style injection. These
// are the first direct tests of it — web's pipeline tests only covered it
// incidentally, and CI now runs core's suite.

import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../pipeline';

describe('sanitize schema', () => {
  it('strips <script> entirely', async () => {
    const html = await renderMarkdown('hello\n\n<script>alert(1)</script>\n');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('strips inline event handlers', async () => {
    const html = await renderMarkdown('<img src="https://example.com/x.png" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('strips style attributes (CSS overlay phishing surface)', async () => {
    const html = await renderMarkdown('<div style="position:fixed;inset:0">x</div>');
    expect(html).not.toContain('style=');
  });

  it('strips iframes', async () => {
    const html = await renderMarkdown('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toContain('<iframe');
  });

  it('blocks javascript: hrefs', async () => {
    const html = await renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('blocks data: image URIs but keeps the private asset: scheme', async () => {
    const data = await renderMarkdown('![x](data:image/svg+xml;base64,PHN2Zy8+)');
    expect(data).not.toContain('data:image');
    const asset = await renderMarkdown('![x](asset:abc123)');
    expect(asset).toContain('src="asset:abc123"');
  });

  it('keeps ordinary markdown intact', async () => {
    const html = await renderMarkdown('# Title\n\n**bold** and [a link](https://example.com)\n');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
  });
});
