import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

// ---------------------------------------------------------------------------
// Tests
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
