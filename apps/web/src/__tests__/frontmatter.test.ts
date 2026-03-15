import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';

describe('parseFrontmatter', () => {
  it('returns empty data when no frontmatter present', () => {
    const result = parseFrontmatter('# Hello World\n\nSome content.');
    expect(result.data).toEqual({});
    expect(result.content).toBe('# Hello World\n\nSome content.');
  });

  it('returns empty data when only opening fence exists', () => {
    const result = parseFrontmatter('---\ntitle: Test\nNo closing fence');
    expect(result.data).toEqual({});
  });

  it('parses string values', () => {
    const md = '---\ntitle: My Document\nauthor: John Doe\n---\n# Content';
    const result = parseFrontmatter(md);
    expect(result.data.title).toBe('My Document');
    expect(result.data.author).toBe('John Doe');
    expect(result.content).toBe('# Content');
  });

  it('parses quoted string values', () => {
    const md = '---\ntitle: "Quoted Title"\n---\nContent';
    const result = parseFrontmatter(md);
    expect(result.data.title).toBe('Quoted Title');
  });

  it('parses boolean values', () => {
    const md = '---\ndraft: true\npublished: false\n---\nContent';
    const result = parseFrontmatter(md);
    expect(result.data.draft).toBe(true);
    expect(result.data.published).toBe(false);
  });

  it('parses numeric values', () => {
    const md = '---\nversion: 3\npriority: 1.5\n---\nContent';
    const result = parseFrontmatter(md);
    expect(result.data.version).toBe(3);
    expect(result.data.priority).toBe(1.5);
  });

  it('parses array values', () => {
    const md = '---\ntags: [javascript, react, testing]\n---\nContent';
    const result = parseFrontmatter(md);
    expect(result.data.tags).toEqual(['javascript', 'react', 'testing']);
  });

  it('parses arrays with quoted values', () => {
    const md = '---\ntags: ["hello world", \'foo bar\']\n---\nContent';
    const result = parseFrontmatter(md);
    expect(result.data.tags).toEqual(['hello world', 'foo bar']);
  });

  it('handles leading whitespace before frontmatter', () => {
    const md = '  \n---\ntitle: Test\n---\nContent';
    const result = parseFrontmatter(md);
    expect(result.data.title).toBe('Test');
  });

  it('strips content correctly after frontmatter', () => {
    const md = '---\ntitle: Test\n---\n\n# Heading\n\nParagraph text.';
    const result = parseFrontmatter(md);
    expect(result.content).toContain('# Heading');
    expect(result.content).toContain('Paragraph text.');
    expect(result.content).not.toContain('---');
  });

  it('handles multi-word keys with hyphens', () => {
    const md = '---\ncreated-at: 2026-01-01\n---\nContent';
    const result = parseFrontmatter(md);
    expect(result.data['created-at']).toBe('2026-01-01');
  });
});
