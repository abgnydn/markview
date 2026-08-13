// Regression tests for the 2026-08-10 audit wave. Each case here failed
// against the pre-audit code — they exist to keep these specific bugs
// from coming back, so prefer asserting the exact broken behaviour over
// paraphrasing the feature.

import { describe, it, expect } from 'vitest';
import { markdownToRst, markdownToAsciidoc } from '@/lib/export/export-convert';
import { parseFrontmatter } from '@markview/core';
import { isNewerVersion } from '@/lib/version';
import { typographicReplacement } from '@/components/viewer/editor-typography';

describe('RST export — code protection', () => {
  it('leaves a heading-like comment inside a fence untouched', () => {
    const rst = markdownToRst('# Title\n\n```bash\n# install deps\nbun install\n```\n');
    // The fence body must survive verbatim: no RST underline injected
    // under "# install deps" (the fence handler used to run last).
    expect(rst).toContain('# install deps');
    expect(rst).not.toMatch(/# install deps\n\s*[=~^-]{3,}/);
  });

  it('does not rewrite links or backticks inside a fence', () => {
    const rst = markdownToRst('```md\n[a](b) and `x`\n```\n');
    expect(rst).toContain('[a](b)');
    expect(rst).toContain('`x`');
    expect(rst).not.toContain('`a <b>`_');
  });

  it('converts prose links and inline code outside fences', () => {
    const rst = markdownToRst('See [docs](https://x.dev) and `code`.\n');
    expect(rst).toContain('`docs <https://x.dev>`_');
    expect(rst).toContain('``code``');
  });

  it('keeps heading underlines long enough for docutils', () => {
    // The HR pass used to run after headings and truncate their
    // all-dash underlines to '----', producing "underline too short".
    const rst = markdownToRst('## A longer heading here\n');
    const lines = rst.trim().split('\n');
    const idx = lines.findIndex((l) => l.startsWith('A longer heading'));
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(lines[idx + 1].length).toBeGreaterThanOrEqual(lines[idx].length);
  });

  it('still converts a real horizontal rule', () => {
    expect(markdownToRst('a\n\n---\n\nb\n')).toContain('----');
  });
});

describe('AsciiDoc export — inline code protection', () => {
  it('does not rewrite a markdown link inside inline code', () => {
    const adoc = markdownToAsciidoc('Use `[a](b)` literally.\n');
    expect(adoc).toContain('`[a](b)`');
    expect(adoc).not.toContain('b[a]');
  });
});

describe('frontmatter close delimiter', () => {
  it('does not close on a `---`-prefixed value', () => {
    const { data, content } = parseFrontmatter('---\ntitle: x\nrule: ---bar\n---\nBody here\n');
    expect(data.title).toBe('x');
    expect(content.trim()).toBe('Body here');
  });

  it('does not close on a four-dash rule inside the body split', () => {
    const { data, content } = parseFrontmatter('---\ntitle: y\n---\n\n----\n\nBody\n');
    expect(data.title).toBe('y');
    expect(content).toContain('----');
  });

  it('leaves a document without frontmatter alone', () => {
    const raw = 'No frontmatter\n\n---\n\nJust a rule\n';
    expect(parseFrontmatter(raw).content).toBe(raw);
  });
});

describe('desktop version comparison', () => {
  it('orders numerically, not lexically', () => {
    expect(isNewerVersion('0.3.10', '0.3.9')).toBe(true);
    expect(isNewerVersion('0.3.1', '0.3.1')).toBe(false);
    expect(isNewerVersion('0.3.0', '0.3.1')).toBe(false);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
  });

  it('tolerates a v prefix and short forms', () => {
    expect(isNewerVersion('v0.4', '0.3.9')).toBe(true);
  });
});

describe('smart typography', () => {
  it('opens and closes quotes by context', () => {
    expect(typographicReplacement('', '"')?.insert).toBe('“');
    expect(typographicReplacement('word', '"')?.insert).toBe('”');
  });

  it('leaves ordinary characters alone', () => {
    expect(typographicReplacement('ab', 'c')).toBeNull();
  });
});
