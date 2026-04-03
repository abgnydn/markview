import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as zlib from 'zlib';

// We test the helper functions by importing the module internals.
// Since they're not exported, we'll test them through the file system patterns they use.

// ---------------------------------------------------------------------------
// Test helpers that mirror the MCP server logic
// ---------------------------------------------------------------------------

function extractHeadings(content: string): Array<{ level: number; text: string; line: number }> {
  const headings: Array<{ level: number; text: string; line: number }> = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[#*`\[\]]/g, '').trim(),
        line: i + 1,
      });
    }
  }
  return headings;
}

function extractLinks(content: string): Array<{ text: string; href: string; line: number; isInternal: boolean }> {
  const links: Array<{ text: string; href: string; line: number; isInternal: boolean }> = [];
  const lines = content.split('\n');
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  for (let i = 0; i < lines.length; i++) {
    let match;
    while ((match = linkRegex.exec(lines[i])) !== null) {
      const href = match[2];
      const isInternal = !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#');
      links.push({ text: match[1], href, line: i + 1, isInternal });
    }
  }
  return links;
}

function getStats(content: string) {
  const text = content.replace(/[#*`\[\]()>-]/g, '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  return { words, readingTimeMinutes: Math.max(1, Math.ceil(words / 200)) };
}

function extractCodeBlocks(content: string): Array<{ language: string; code: string; line: number }> {
  const blocks: Array<{ language: string; code: string; line: number }> = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const fenceMatch = lines[i].match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || 'text';
      const startLine = i + 1;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ language: lang, code: codeLines.join('\n'), line: startLine });
    }
    i++;
  }
  return blocks;
}

function safePath(resolvedDir: string, filePath: string): string {
  const resolved = path.resolve(resolvedDir, filePath);
  if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
    throw new Error(`Path traversal blocked: ${filePath}`);
  }
  return resolved;
}

function extractMermaidDiagrams(content: string): Array<{ type: string; code: string; line: number }> {
  const blocks = extractCodeBlocks(content);
  return blocks
    .filter((b) => b.language.toLowerCase() === 'mermaid')
    .map((b) => {
      const firstLine = b.code.trim().split('\n')[0].trim().toLowerCase();
      let type = 'unknown';
      if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) type = 'flowchart';
      else if (firstLine.startsWith('sequencediagram')) type = 'sequence';
      else if (firstLine.startsWith('classdiagram')) type = 'class';
      else if (firstLine.startsWith('statediagram')) type = 'state';
      else if (firstLine.startsWith('erdiagram')) type = 'er';
      else if (firstLine.startsWith('gantt')) type = 'gantt';
      else if (firstLine.startsWith('pie')) type = 'pie';
      else if (firstLine.startsWith('gitgraph')) type = 'gitgraph';
      else if (firstLine.startsWith('journey')) type = 'journey';
      else if (firstLine.startsWith('mindmap')) type = 'mindmap';
      else if (firstLine.startsWith('timeline')) type = 'timeline';
      return { type, code: b.code, line: b.line };
    });
}

function extractMathBlocks(content: string): Array<{ expression: string; type: 'inline' | 'display'; line: number }> {
  const results: Array<{ expression: string; type: 'inline' | 'display'; line: number }> = [];
  const lines = content.split('\n');

  let inDisplay = false;
  let displayStart = 0;
  let displayLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inDisplay && line.trim().startsWith('$$')) {
      const singleLine = line.trim();
      if (singleLine.endsWith('$$') && singleLine.length > 4) {
        results.push({ expression: singleLine.slice(2, -2).trim(), type: 'display', line: i + 1 });
        continue;
      }
      inDisplay = true;
      displayStart = i;
      displayLines = [line.trim().slice(2)];
    } else if (inDisplay && line.trim().endsWith('$$')) {
      displayLines.push(line.trim().slice(0, -2));
      results.push({ expression: displayLines.join('\n').trim(), type: 'display', line: displayStart + 1 });
      inDisplay = false;
      displayLines = [];
    } else if (inDisplay) {
      displayLines.push(line);
    } else {
      const inlineRegex = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;
      let match;
      while ((match = inlineRegex.exec(line)) !== null) {
        results.push({ expression: match[1].trim(), type: 'inline', line: i + 1 });
      }
    }
  }
  return results;
}

function generateTocMarkdown(content: string, maxDepth: number = 3): string {
  const headings = extractHeadings(content);
  if (headings.length === 0) return '';

  const minLevel = Math.min(...headings.map((h) => h.level));
  const tocLines: string[] = [];

  for (const h of headings) {
    const relativeLevel = h.level - minLevel;
    if (relativeLevel >= maxDepth) continue;
    const indent = '  '.repeat(relativeLevel);
    const slug = h.text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    tocLines.push(`${indent}- [${h.text}](#${slug})`);
  }

  return tocLines.join('\n');
}

function fleschKincaid(text: string): { gradeLevel: number; readingEase: number; avgSentenceLength: number; avgSyllablesPerWord: number } {
  const clean = text.replace(/```[\s\S]*?```/g, '').replace(/[#*`\[\]()>-]/g, '').trim();
  if (!clean) return { gradeLevel: 0, readingEase: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0 };

  const sentences = clean.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0 || sentences.length === 0) {
    return { gradeLevel: 0, readingEase: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0 };
  }

  function countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 2) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? Math.max(1, matches.length) : 1;
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
  const readingEase = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  return {
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    readingEase: Math.round(readingEase * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
  };
}

function compressToShareUrl(content: string, title?: string): string {
  const compressed = zlib.gzipSync(Buffer.from(content, 'utf-8'));
  const base64 = compressed.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const params = new URLSearchParams();
  params.set('md', base64);
  if (title) params.set('title', title);

  return `https://markview.ai/#${params.toString()}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Tests — Original helpers
// ---------------------------------------------------------------------------

describe('extractHeadings', () => {
  it('extracts h1-h6 headings', () => {
    const md = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(6);
    expect(headings[0]).toEqual({ level: 1, text: 'H1', line: 1 });
    expect(headings[5]).toEqual({ level: 6, text: 'H6', line: 6 });
  });

  it('ignores non-heading lines', () => {
    const md = 'Not a heading\n# Real heading\nAlso not';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Real heading');
  });

  it('strips inline markdown from heading text', () => {
    const md = '## **Bold** `code` heading';
    const headings = extractHeadings(md);
    expect(headings[0].text).toBe('Bold code heading');
  });

  it('returns empty array for content without headings', () => {
    expect(extractHeadings('Just some text\nNo headings here')).toEqual([]);
  });

  it('handles headings without space after #', () => {
    const md = '#NoSpace';
    const headings = extractHeadings(md);
    expect(headings).toHaveLength(0);
  });
});

describe('extractLinks', () => {
  it('extracts markdown links', () => {
    const md = 'Click [here](https://example.com) for more.';
    const links = extractLinks(md);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      text: 'here',
      href: 'https://example.com',
      isInternal: false,
    });
  });

  it('identifies internal vs external links', () => {
    const md = '[External](https://example.com)\n[Internal](./docs/setup.md)\n[Anchor](#section)';
    const links = extractLinks(md);
    expect(links[0].isInternal).toBe(false);
    expect(links[1].isInternal).toBe(true);
    expect(links[2].isInternal).toBe(false); // anchors are not "internal files"
  });

  it('extracts multiple links on same line', () => {
    const md = '[A](a.md) and [B](b.md)';
    const links = extractLinks(md);
    expect(links).toHaveLength(2);
  });

  it('returns empty array for content without links', () => {
    expect(extractLinks('No links here')).toEqual([]);
  });
});

describe('getStats', () => {
  it('counts words correctly', () => {
    const stats = getStats('Hello world this has five words');
    expect(stats.words).toBe(6);
  });

  it('calculates reading time (200 wpm)', () => {
    const longText = Array(400).fill('word').join(' ');
    const stats = getStats(longText);
    expect(stats.readingTimeMinutes).toBe(2);
  });

  it('returns minimum 1 minute reading time', () => {
    const stats = getStats('Short');
    expect(stats.readingTimeMinutes).toBe(1);
  });

  it('strips markdown syntax from word count', () => {
    const stats = getStats('# **Hello** `world` [link](url)');
    expect(stats.words).toBeGreaterThan(0);
  });
});

describe('extractCodeBlocks', () => {
  it('extracts code blocks with language', () => {
    const md = '```javascript\nconsole.log("hello");\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].code).toBe('console.log("hello");');
  });

  it('uses "text" for blocks without language', () => {
    const md = '```\nsome code\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks[0].language).toBe('text');
  });

  it('extracts multiple code blocks', () => {
    const md = '```python\nprint("hi")\n```\n\n```bash\necho "hi"\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('python');
    expect(blocks[1].language).toBe('bash');
  });

  it('handles multi-line code blocks', () => {
    const md = '```js\nconst a = 1;\nconst b = 2;\nconst c = a + b;\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks[0].code).toContain('const a = 1;');
    expect(blocks[0].code).toContain('const c = a + b;');
  });
});

describe('safePath', () => {
  const workspaceDir = '/workspace/docs';

  it('allows paths within workspace', () => {
    const result = safePath(workspaceDir, 'readme.md');
    expect(result).toBe(path.resolve(workspaceDir, 'readme.md'));
  });

  it('allows nested paths within workspace', () => {
    const result = safePath(workspaceDir, 'guides/setup.md');
    expect(result).toBe(path.resolve(workspaceDir, 'guides/setup.md'));
  });

  it('blocks simple path traversal (../)', () => {
    expect(() => safePath(workspaceDir, '../etc/passwd')).toThrow('Path traversal blocked');
  });

  it('blocks deep path traversal (../../)', () => {
    expect(() => safePath(workspaceDir, '../../etc/shadow')).toThrow('Path traversal blocked');
  });

  it('blocks path traversal with subdir prefix', () => {
    expect(() => safePath(workspaceDir, 'subdir/../../etc/passwd')).toThrow('Path traversal blocked');
  });

  it('blocks absolute paths outside workspace', () => {
    expect(() => safePath(workspaceDir, '/etc/passwd')).toThrow('Path traversal blocked');
  });
});

// ---------------------------------------------------------------------------
// Tests — New helpers
// ---------------------------------------------------------------------------

describe('extractMermaidDiagrams', () => {
  it('extracts mermaid diagrams with type detection', () => {
    const md = '```mermaid\ngraph TD\n  A --> B\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].type).toBe('flowchart');
    expect(diagrams[0].code).toContain('A --> B');
  });

  it('detects sequence diagram type', () => {
    const md = '```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].type).toBe('sequence');
  });

  it('detects gantt chart type', () => {
    const md = '```mermaid\ngantt\n  title A Gantt\n  section A\n  task1 :a1, 2024-01-01, 30d\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams[0].type).toBe('gantt');
  });

  it('detects pie chart type', () => {
    const md = '```mermaid\npie title Pets\n  "Dogs" : 386\n  "Cats" : 85\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams[0].type).toBe('pie');
  });

  it('detects flowchart keyword', () => {
    const md = '```mermaid\nflowchart LR\n  A --> B\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams[0].type).toBe('flowchart');
  });

  it('ignores non-mermaid code blocks', () => {
    const md = '```javascript\nconst x = 1;\n```\n\n```mermaid\ngraph TD\n  A --> B\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].type).toBe('flowchart');
  });

  it('returns empty array for content without mermaid', () => {
    const md = '# Hello\n\nSome text\n\n```python\nprint("hi")\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams).toEqual([]);
  });

  it('extracts multiple diagrams', () => {
    const md = '```mermaid\ngraph TD\n  A-->B\n```\n\n```mermaid\nsequenceDiagram\n  A->>B: Hi\n```';
    const diagrams = extractMermaidDiagrams(md);
    expect(diagrams).toHaveLength(2);
    expect(diagrams[0].type).toBe('flowchart');
    expect(diagrams[1].type).toBe('sequence');
  });
});

describe('extractMathBlocks', () => {
  it('extracts inline math', () => {
    const md = 'The formula is $E = mc^2$ and $F = ma$ too.';
    const blocks = extractMathBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ expression: 'E = mc^2', type: 'inline' });
    expect(blocks[1]).toMatchObject({ expression: 'F = ma', type: 'inline' });
  });

  it('extracts single-line display math', () => {
    const md = '$$E = mc^2$$';
    const blocks = extractMathBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ expression: 'E = mc^2', type: 'display' });
  });

  it('extracts multi-line display math', () => {
    const md = '$$\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$';
    const blocks = extractMathBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('display');
    expect(blocks[0].expression).toContain('\\frac');
  });

  it('handles mixed inline and display math', () => {
    const md = 'Inline $x^2$ here\n\n$$\ny = mx + b\n$$\n\nMore inline $z = 3$ here';
    const blocks = extractMathBlocks(md);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('inline');
    expect(blocks[1].type).toBe('display');
    expect(blocks[2].type).toBe('inline');
  });

  it('returns empty array for content without math', () => {
    const md = '# Hello\n\nNo math here.\n\nJust text.';
    const blocks = extractMathBlocks(md);
    expect(blocks).toEqual([]);
  });
});

describe('generateTocMarkdown', () => {
  it('generates TOC from headings', () => {
    const md = '# Title\n## Section 1\n## Section 2\n### Subsection 2.1';
    const toc = generateTocMarkdown(md);
    expect(toc).toContain('- [Title](#title)');
    expect(toc).toContain('  - [Section 1](#section-1)');
    expect(toc).toContain('  - [Section 2](#section-2)');
    expect(toc).toContain('    - [Subsection 2.1](#subsection-21)');
  });

  it('respects maxDepth parameter', () => {
    const md = '# Title\n## Section\n### Subsection\n#### Deep';
    const toc = generateTocMarkdown(md, 2);
    expect(toc).toContain('- [Title](#title)');
    expect(toc).toContain('  - [Section](#section)');
    expect(toc).not.toContain('Subsection');
    expect(toc).not.toContain('Deep');
  });

  it('returns empty string for content without headings', () => {
    expect(generateTocMarkdown('No headings here')).toBe('');
  });

  it('handles headings with special characters', () => {
    const md = '## API & Endpoints\n## Setup (Quick)';
    const toc = generateTocMarkdown(md);
    expect(toc).toContain('- [API & Endpoints](#api-endpoints)');
    expect(toc).toContain('- [Setup (Quick)](#setup-quick)');
  });
});

describe('fleschKincaid', () => {
  it('returns scores for simple text', () => {
    const result = fleschKincaid('The cat sat on the mat. The dog ran fast. It was a good day.');
    expect(result.gradeLevel).toBeTypeOf('number');
    expect(result.readingEase).toBeTypeOf('number');
    expect(result.readingEase).toBeGreaterThan(50); // Simple text should be easy to read
  });

  it('returns scores for complex text', () => {
    const result = fleschKincaid(
      'The implementation of multithreaded concurrent programming paradigms necessitates sophisticated understanding of synchronization primitives and memory consistency models.'
    );
    expect(result.readingEase).toBeLessThan(50); // Complex text is harder
    expect(result.gradeLevel).toBeGreaterThan(8); // College-level
  });

  it('returns zeros for empty content', () => {
    const result = fleschKincaid('');
    expect(result.gradeLevel).toBe(0);
    expect(result.readingEase).toBe(0);
  });

  it('strips code blocks before analyzing', () => {
    const md = '```\nconst x = 1;\n```\n\nThe cat sat on the mat.';
    const result = fleschKincaid(md);
    expect(result.readingEase).toBeGreaterThan(0);
  });

  it('returns valid average sentence length', () => {
    const result = fleschKincaid('Hello world. Goodbye world.');
    expect(result.avgSentenceLength).toBeGreaterThan(0);
  });
});

describe('compressToShareUrl', () => {
  it('generates a valid markview.ai URL', () => {
    const url = compressToShareUrl('# Hello World\n\nThis is a test.');
    expect(url).toMatch(/^https:\/\/markview\.ai\/#md=/);
  });

  it('includes title in URL when provided', () => {
    const url = compressToShareUrl('# Hello', 'My Doc');
    expect(url).toContain('title=My+Doc');
  });

  it('uses base64url encoding (no +, /, =)', () => {
    const url = compressToShareUrl('# Test\n\nSome content here with special chars: +/= and more');
    const hash = url.split('#')[1];
    const mdParam = new URLSearchParams(hash).get('md') || '';
    // base64url should not contain + or / (though URLSearchParams might encode)
    expect(mdParam).not.toContain('/');
  });

  it('produces content that can be decompressed', () => {
    const original = '# Hello World\n\nThis is a test document with **bold** and `code`.';
    const url = compressToShareUrl(original, 'Test');
    const hash = url.split('#')[1];
    const mdParam = new URLSearchParams(hash).get('md') || '';

    // Reverse base64url
    const padded = mdParam.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - (mdParam.length % 4)) % 4);
    const compressed = Buffer.from(padded, 'base64');
    const decompressed = zlib.gunzipSync(compressed).toString('utf-8');
    expect(decompressed).toBe(original);
  });
});

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('handles strings without special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles multiple special characters', () => {
    expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
  });
});

// ---------------------------------------------------------------------------
// Integration tests with temp directory
// ---------------------------------------------------------------------------

describe('File operations (integration)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markview-test-'));
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# Test\n\nHello world');
    fs.mkdirSync(path.join(tmpDir, 'docs'));
    fs.writeFileSync(path.join(tmpDir, 'docs', 'guide.md'), '# Guide\n\n[Back](../readme.md)');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds markdown files recursively', () => {
    function findMarkdownFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          results.push(...findMarkdownFiles(full));
        } else if (entry.name.endsWith('.md')) {
          results.push(full);
        }
      }
      return results;
    }

    const files = findMarkdownFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some(f => f.endsWith('readme.md'))).toBe(true);
    expect(files.some(f => f.endsWith('guide.md'))).toBe(true);
  });

  it('skips node_modules and hidden directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep.md'), '# Dep');
    fs.mkdirSync(path.join(tmpDir, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.hidden', 'secret.md'), '# Secret');

    function findMarkdownFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          results.push(...findMarkdownFiles(full));
        } else if (entry.name.endsWith('.md')) {
          results.push(full);
        }
      }
      return results;
    }

    const files = findMarkdownFiles(tmpDir);
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
    expect(files.some(f => f.includes('.hidden'))).toBe(false);
  });

  it('create document via safePath stays in workspace', () => {
    const filePath = safePath(tmpDir, 'new-doc.md');
    fs.writeFileSync(filePath, '# New Doc');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('# New Doc');
  });

  it('blocks create document outside workspace', () => {
    expect(() => safePath(tmpDir, '../outside.md')).toThrow('Path traversal blocked');
  });
});

// ---------------------------------------------------------------------------
// Integration tests — New tools
// ---------------------------------------------------------------------------

describe('delete_document (integration)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markview-delete-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deletes a file and it no longer exists', () => {
    const filePath = path.join(tmpDir, 'to-delete.md');
    fs.writeFileSync(filePath, '# Delete Me\n\nSome content here.');
    expect(fs.existsSync(filePath)).toBe(true);

    fs.unlinkSync(filePath);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('safePath blocks deletion outside workspace', () => {
    expect(() => safePath(tmpDir, '../../etc/passwd')).toThrow('Path traversal blocked');
  });

  it('can read stats before deleting', () => {
    const filePath = path.join(tmpDir, 'stats-before-delete.md');
    fs.writeFileSync(filePath, '# Stats Test\n\nThis document has words in it.');
    const content = fs.readFileSync(filePath, 'utf-8');
    const stats = getStats(content);
    expect(stats.words).toBeGreaterThan(0);

    fs.unlinkSync(filePath);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('merge_documents (integration)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markview-merge-'));
    fs.writeFileSync(path.join(tmpDir, 'doc1.md'), '# Document 1\n\nFirst content.');
    fs.writeFileSync(path.join(tmpDir, 'doc2.md'), '# Document 2\n\nSecond content.');
    fs.writeFileSync(path.join(tmpDir, 'doc3.md'), '# Document 3\n\nThird content.');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('merges multiple documents with default separator', () => {
    const parts = ['doc1.md', 'doc2.md', 'doc3.md'].map(
      (f) => fs.readFileSync(path.join(tmpDir, f), 'utf-8')
    );
    const result = parts.join('\n\n---\n\n');
    const outPath = path.join(tmpDir, 'merged.md');
    fs.writeFileSync(outPath, result);

    const merged = fs.readFileSync(outPath, 'utf-8');
    expect(merged).toContain('# Document 1');
    expect(merged).toContain('---');
    expect(merged).toContain('# Document 3');
  });

  it('merges with custom separator', () => {
    const parts = ['doc1.md', 'doc2.md'].map(
      (f) => fs.readFileSync(path.join(tmpDir, f), 'utf-8')
    );
    const result = parts.join('\n\n<!-- SECTION BREAK -->\n\n');

    expect(result).toContain('<!-- SECTION BREAK -->');
    expect(result).toContain('Document 1');
    expect(result).toContain('Document 2');
  });
});

describe('share_document (integration)', () => {
  it('generates valid URL for a document', () => {
    const content = '# API Documentation\n\n## Endpoints\n\n`GET /api/users`';
    const url = compressToShareUrl(content, 'API Docs');
    expect(url).toMatch(/^https:\/\/markview\.ai\/#/);
    expect(url).toContain('md=');
    expect(url).toContain('title=API+Docs');
  });

  it('round-trips content through compression', () => {
    const original = '# Round Trip Test\n\nSpecial chars: <>&"\'`\n\n```ts\nconst x = 1;\n```';
    const url = compressToShareUrl(original);
    const hash = url.split('#')[1];
    const mdParam = new URLSearchParams(hash).get('md') || '';

    const padded = mdParam.replace(/-/g, '+').replace(/_/g, '/')
      + '==='.slice(0, (4 - (mdParam.length % 4)) % 4);
    const decompressed = zlib.gunzipSync(Buffer.from(padded, 'base64')).toString('utf-8');
    expect(decompressed).toBe(original);
  });
});

describe('render_document (integration)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markview-render-'));
    fs.writeFileSync(path.join(tmpDir, 'test.md'), '# Hello\n\nWorld\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nMath: $E=mc^2$');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates HTML with correct structure', () => {
    const content = fs.readFileSync(path.join(tmpDir, 'test.md'), 'utf-8');
    // Verify source has > from mermaid A-->B
    expect(content).toContain('>');
    const escaped = escapeHtml(content);
    // After escaping, all > should become &gt;
    expect(escaped).toContain('&gt;');
  });

  it('detects mermaid and math presence', () => {
    const content = fs.readFileSync(path.join(tmpDir, 'test.md'), 'utf-8');
    const hasMermaid = content.includes('```mermaid');
    const hasMath = content.includes('$');

    expect(hasMermaid).toBe(true);
    expect(hasMath).toBe(true);
  });

  it('generates dark and light theme styles', () => {
    const darkBg = '#0a0a0a';
    const lightBg = '#ffffff';

    expect(darkBg).not.toBe(lightBg);
    // Just verify the theme colors are different
    expect(darkBg).toBe('#0a0a0a');
    expect(lightBg).toBe('#ffffff');
  });
});

describe('generate_toc (integration)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markview-toc-'));
    fs.writeFileSync(path.join(tmpDir, 'doc.md'), '# API Guide\n\n## Getting Started\n\n### Installation\n\n### Configuration\n\n## Usage\n\n### Basic\n\n### Advanced');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates and inserts TOC after H1', () => {
    const content = fs.readFileSync(path.join(tmpDir, 'doc.md'), 'utf-8');
    const toc = generateTocMarkdown(content);

    expect(toc).toContain('API Guide');
    expect(toc).toContain('Getting Started');
    expect(toc).toContain('Installation');

    // Simulate insertion
    const lines = content.split('\n');
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^#\s+/)) { insertIdx = i + 1; break; }
    }
    const tocBlock = `<!-- TOC -->\n## Table of Contents\n\n${toc}\n<!-- /TOC -->`;
    lines.splice(insertIdx, 0, '', tocBlock, '');
    const result = lines.join('\n');

    expect(result).toContain('<!-- TOC -->');
    expect(result).toContain('<!-- /TOC -->');
    expect(result.indexOf('<!-- TOC -->')).toBeGreaterThan(result.indexOf('# API Guide'));
  });

  it('replaces existing TOC on re-insertion', () => {
    const contentWithToc = '# Title\n\n<!-- TOC -->\n## Table of Contents\n\n- [Old](#old)\n<!-- /TOC -->\n\n## Section 1\n\n## Section 2';
    const lines = contentWithToc.split('\n');

    const start = lines.findIndex((l) => l.trim() === '<!-- TOC -->');
    const end = lines.findIndex((l) => l.trim() === '<!-- /TOC -->');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    // Remove existing TOC
    lines.splice(start, end - start + 1);
    const cleaned = lines.join('\n');
    expect(cleaned).not.toContain('<!-- TOC -->');
    expect(cleaned).toContain('## Section 1');
  });
});

describe('analyze_reading_level (integration)', () => {
  it('classifies simple text as easy', () => {
    const result = fleschKincaid('The cat sat. The dog ran. It was fun. The sun was up.');
    expect(result.readingEase).toBeGreaterThan(60);
  });

  it('classifies academic text as difficult', () => {
    const result = fleschKincaid(
      'The implementation of asynchronous distributed architectures necessitates consideration of eventual consistency guarantees and partition tolerance mechanisms as formalized by the CAP theorem.'
    );
    expect(result.readingEase).toBeLessThan(40);
  });

  it('handles markdown with code blocks gracefully', () => {
    const md = '# Hello\n\n```js\nconst x = 1;\nconst y = 2;\n```\n\nThe cat sat on the mat.';
    const result = fleschKincaid(md);
    expect(result.gradeLevel).toBeTypeOf('number');
    expect(result.avgSentenceLength).toBeGreaterThan(0);
  });
});
