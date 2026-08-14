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

  it('escapes the un-rendered math fallback (KaTeX RangeError breakout)', async () => {
    // Deeply-nested \frac blows KaTeX's parser stack → RangeError, which is
    // NOT a ParseError so it escapes throwOnError:false and hits the app's
    // fallback catch. That branch splices raw source into post-sanitize HTML,
    // so it must escape the body itself or a </code> breakout executes.
    const breakout = '\\frac{1}{'.repeat(2000) + '2' + '}'.repeat(2000) + '</code><img src=x onerror=alert(1)>';
    const inline = await renderMarkdown('$' + breakout + '$', { katex: true });
    expect(inline).not.toContain('<img src=x onerror');
    const block = await renderMarkdown('$$' + breakout.replace('</code>', '</code></pre>') + '$$', { katex: true });
    expect(block).not.toContain('<img src=x onerror');
  });

  it('keeps ordinary markdown intact', async () => {
    const html = await renderMarkdown('# Title\n\n**bold** and [a link](https://example.com)\n');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
  });
});
