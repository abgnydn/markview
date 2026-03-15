import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '@/lib/markdown/pipeline';

describe('renderMarkdown', () => {
  it('renders basic markdown to HTML', async () => {
    const html = await renderMarkdown('# Hello World');
    expect(html).toContain('<h1');
    expect(html).toContain('Hello World');
  });

  it('renders bold and italic text', async () => {
    const html = await renderMarkdown('**bold** and *italic*');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('renders inline code', async () => {
    const html = await renderMarkdown('Use `console.log()`');
    expect(html).toContain('<code>console.log()</code>');
  });

  it('renders links', async () => {
    const html = await renderMarkdown('[Click here](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Click here');
  });

  it('renders unordered lists', async () => {
    const html = await renderMarkdown('- Item 1\n- Item 2\n- Item 3');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
    expect(html).toContain('Item 1');
  });

  it('renders ordered lists', async () => {
    const html = await renderMarkdown('1. First\n2. Second');
    expect(html).toContain('<ol>');
    expect(html).toContain('First');
  });

  it('renders tables (GFM)', async () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const html = await renderMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('<td>');
  });

  it('renders task lists', async () => {
    const md = '- [x] Done\n- [ ] Todo';
    const html = await renderMarkdown(md);
    expect(html).toContain('type="checkbox"');
  });

  it('renders blockquotes', async () => {
    const html = await renderMarkdown('> This is a quote');
    expect(html).toContain('<blockquote>');
  });

  it('renders fenced code blocks', async () => {
    const md = '```javascript\nconsole.log("hello");\n```';
    const html = await renderMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });

  it('renders horizontal rules', async () => {
    const html = await renderMarkdown('---');
    expect(html).toContain('<hr');
  });

  it('renders strikethrough text', async () => {
    const html = await renderMarkdown('~~deleted~~');
    expect(html).toContain('<del>deleted</del>');
  });
});

describe('XSS Sanitization', () => {
  it('strips <script> tags', async () => {
    const html = await renderMarkdown('<script>alert("xss")</script>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('strips onerror event handlers', async () => {
    const html = await renderMarkdown('<img onerror="alert(1)" src="x">');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert');
  });

  it('strips onload event handlers', async () => {
    const html = await renderMarkdown('<img onload="alert(1)" src="x">');
    expect(html).not.toContain('onload');
  });

  it('strips onclick event handlers', async () => {
    const html = await renderMarkdown('<div onclick="alert(1)">Click</div>');
    expect(html).not.toContain('onclick');
  });

  it('strips <iframe> tags', async () => {
    const html = await renderMarkdown('<iframe src="https://evil.com"></iframe>');
    expect(html).not.toContain('<iframe');
  });

  it('strips <style> tags', async () => {
    const html = await renderMarkdown('<style>body { display: none; }</style>');
    expect(html).not.toContain('<style');
  });

  it('strips <object> tags', async () => {
    const html = await renderMarkdown('<object data="evil.swf"></object>');
    expect(html).not.toContain('<object');
  });

  it('strips <embed> tags', async () => {
    const html = await renderMarkdown('<embed src="evil.swf">');
    expect(html).not.toContain('<embed');
  });

  it('strips <form> tags', async () => {
    const html = await renderMarkdown('<form action="https://evil.com"><input></form>');
    expect(html).not.toContain('<form');
  });

  it('strips javascript: URLs in links', async () => {
    const html = await renderMarkdown('<a href="javascript:alert(1)">Click</a>');
    expect(html).not.toContain('javascript:');
  });

  it('preserves safe HTML elements', async () => {
    const html = await renderMarkdown('<strong>Bold</strong> and <em>italic</em>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('preserves GitHub alert markup', async () => {
    const md = '> [!NOTE]\n> This is a note.';
    const html = await renderMarkdown(md);
    expect(html).toContain('gh-alert');
  });
});
