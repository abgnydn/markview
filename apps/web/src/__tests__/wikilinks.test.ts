import { describe, it, expect } from 'vitest';
import { expandWikilinks } from '@/lib/markdown/wikilinks';

describe('expandWikilinks', () => {
  it('expands a bare wikilink to a .md link', () => {
    expect(expandWikilinks('See [[notes]] here')).toBe('See [notes](notes.md) here');
  });

  it('honors pipe aliases', () => {
    expect(expandWikilinks('[[file-name|Display Text]]')).toBe('[Display Text](file-name.md)');
  });

  it('leaves wikilinks inside fenced code blocks verbatim', () => {
    const src = '```\nSee [[foo]] in the config\n```';
    expect(expandWikilinks(src)).toBe(src);
  });

  it('leaves wikilinks inside inline code verbatim', () => {
    const src = 'Use `[[bar]]` literally';
    expect(expandWikilinks(src)).toBe(src);
  });

  it('still expands outside code while preserving code segments', () => {
    const out = expandWikilinks('[[a]] and `[[b]]` and [[c]]');
    expect(out).toBe('[a](a.md) and `[[b]]` and [c](c.md)');
  });
});
