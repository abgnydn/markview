// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { tsvToMarkdownTable, htmlTableToMarkdown, clipboardToTable } from '@/components/viewer/editor-paste';

describe('smart-paste table conversion', () => {
  it('converts tab-separated text (Excel/Sheets) to a markdown table', () => {
    const md = tsvToMarkdownTable('Name\tAge\nAda\t36\nAlan\t41');
    expect(md).toBe('| Name | Age |\n| --- | --- |\n| Ada | 36 |\n| Alan | 41 |');
  });

  it('pads ragged rows and escapes pipes', () => {
    const md = tsvToMarkdownTable('a\tb\tc\nx\ty|z');
    expect(md).toContain('| x | y\\|z |  |'); // 3rd column padded empty
  });

  it('returns null for single-column / non-tabular text', () => {
    expect(tsvToMarkdownTable('just a sentence')).toBeNull();
    expect(tsvToMarkdownTable('one\ntwo\nthree')).toBeNull();
  });

  it('converts an HTML <table> fragment', () => {
    const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
    expect(htmlTableToMarkdown(html)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });

  it('clipboardToTable prefers TSV then falls back to HTML', () => {
    expect(clipboardToTable('p\tq\n1\t2', '')).toContain('| p | q |');
    expect(clipboardToTable('no tabs here', '<table><tr><td>x</td><td>y</td></tr></table>')).toContain('| x | y |');
    expect(clipboardToTable('plain', '<p>not a table</p>')).toBeNull();
  });
});
