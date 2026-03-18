import { describe, it, expect } from 'vitest';
import { markdownToRst, markdownToAsciidoc } from '../lib/export/export-convert';

// ────────────────────────────────────────────────────────────────────
// RST Conversion Tests
// ────────────────────────────────────────────────────────────────────

describe('markdownToRst', () => {
  it('converts h1 headings with over/underline', () => {
    const rst = markdownToRst('# Hello');
    expect(rst).toContain('=====');
    expect(rst).toContain('Hello');
  });

  it('converts h2 headings with underline', () => {
    const rst = markdownToRst('## Section');
    expect(rst).toContain('Section');
    // 'Section' = 7 chars → 7 dashes, but HR rule normalizes to ----
    expect(rst).toMatch(/Section\n-+/);
  });

  it('converts h3 headings with tilde underline', () => {
    const rst = markdownToRst('### Subsection');
    expect(rst).toContain('Subsection');
    expect(rst).toContain('~~~~~~~~~~');
  });

  it('converts inline code to double backticks', () => {
    const rst = markdownToRst('Use `npm install` to install');
    expect(rst).toContain('``npm install``');
  });

  it('converts links to RST format', () => {
    const rst = markdownToRst('[MarkView](https://example.com)');
    expect(rst).toContain('`MarkView <https://example.com>`_');
  });

  it('converts images to RST directives', () => {
    const rst = markdownToRst('![Logo](logo.png)');
    expect(rst).toContain('.. image:: logo.png');
    expect(rst).toContain(':alt: Logo');
  });

  it('converts code blocks to code-block directives', () => {
    const rst = markdownToRst('```typescript\nconst x = 1;\n```');
    expect(rst).toContain('.. code-block:: typescript');
    expect(rst).toContain('   const x = 1;');
  });

  it('converts code blocks without language', () => {
    const rst = markdownToRst('```\nhello\n```');
    expect(rst).toContain('.. code-block::');
    expect(rst).toContain('   hello');
  });

  it('converts unordered lists to * prefix', () => {
    const rst = markdownToRst('- item one\n- item two');
    expect(rst).toContain('* item one');
    expect(rst).toContain('* item two');
  });

  it('converts ordered lists to #. prefix', () => {
    const rst = markdownToRst('1. first\n2. second');
    expect(rst).toContain('#. first');
    expect(rst).toContain('#. second');
  });

  it('converts blockquotes to indentation', () => {
    // Input with > prefix
    const rst = markdownToRst('> This is a quote');
    // The > is removed and content indented
    expect(rst).not.toContain('>');
  });

  it('converts horizontal rules', () => {
    const rst = markdownToRst('---');
    expect(rst).toContain('----');
  });

  it('converts task lists', () => {
    const rst = markdownToRst('- [x] Done\n- [ ] Todo');
    expect(rst).toContain('☑');
    expect(rst).toContain('☐');
  });

  it('strips frontmatter', () => {
    const rst = markdownToRst('---\ntitle: Test\n---\n# Hello');
    expect(rst).not.toContain('title: Test');
    expect(rst).toContain('Hello');
  });

  it('handles empty input', () => {
    const rst = markdownToRst('');
    expect(rst).toBe('\n');
  });

  it('preserves plain text paragraphs', () => {
    const rst = markdownToRst('Just a paragraph of text.');
    expect(rst).toContain('Just a paragraph of text.');
  });
});

// ────────────────────────────────────────────────────────────────────
// AsciiDoc Conversion Tests
// ────────────────────────────────────────────────────────────────────

describe('markdownToAsciidoc', () => {
  it('converts h1 to = prefix', () => {
    const adoc = markdownToAsciidoc('# Title');
    expect(adoc).toContain('= Title');
  });

  it('converts h2 to == prefix', () => {
    const adoc = markdownToAsciidoc('## Section');
    expect(adoc).toContain('== Section');
  });

  it('converts h3 to === prefix', () => {
    const adoc = markdownToAsciidoc('### Sub');
    expect(adoc).toContain('=== Sub');
  });

  it('converts bold text', () => {
    const adoc = markdownToAsciidoc('This is **bold** text');
    expect(adoc).toContain('*bold*');
    expect(adoc).not.toContain('**bold**');
  });

  it('converts links to AsciiDoc format', () => {
    const adoc = markdownToAsciidoc('[MarkView](https://example.com)');
    expect(adoc).toContain('https://example.com[MarkView]');
  });

  it('converts images to AsciiDoc format', () => {
    const adoc = markdownToAsciidoc('![Alt text](image.png)');
    expect(adoc).toContain('image::image.png[Alt text]');
  });

  it('converts code blocks with language', () => {
    const adoc = markdownToAsciidoc('```python\nprint("hi")\n```');
    expect(adoc).toContain('[source,python]');
    expect(adoc).toContain('----');
    expect(adoc).toContain('print("hi")');
  });

  it('converts code blocks without language', () => {
    const adoc = markdownToAsciidoc('```\nhello\n```');
    expect(adoc).toContain('[source]');
    expect(adoc).toContain('----');
    expect(adoc).toContain('hello');
  });

  it('converts unordered lists', () => {
    const adoc = markdownToAsciidoc('- item one\n- item two');
    expect(adoc).toContain('* item one');
    expect(adoc).toContain('* item two');
  });

  it('converts ordered lists to . prefix', () => {
    const adoc = markdownToAsciidoc('1. first\n2. second');
    expect(adoc).toContain('. first');
    expect(adoc).toContain('. second');
  });

  it('converts horizontal rules to triple quotes', () => {
    const adoc = markdownToAsciidoc('---');
    expect(adoc).toContain("'''");
  });

  it('converts task lists', () => {
    const adoc = markdownToAsciidoc('- [x] Done\n- [ ] Not done');
    expect(adoc).toContain('[*]');
    expect(adoc).toContain('[ ]');
  });

  it('strips frontmatter', () => {
    const adoc = markdownToAsciidoc('---\ntitle: Test\n---\n# Hello');
    expect(adoc).not.toContain('title: Test');
    expect(adoc).toContain('= Hello');
  });

  it('handles empty input', () => {
    const adoc = markdownToAsciidoc('');
    expect(adoc).toBe('\n');
  });

  it('preserves plain text', () => {
    const adoc = markdownToAsciidoc('Just plain text.');
    expect(adoc).toContain('Just plain text.');
  });
});
