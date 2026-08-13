// @vitest-environment node
// chunkContent feeds search, related-notes, and the AI chat context — a
// regression here silently degrades all three.

import { describe, it, expect } from 'vitest';
import { chunkContent } from '@/lib/embeddings';

describe('chunkContent', () => {
  it('splits on blank lines and skips ultra-short fragments', () => {
    const chunks = chunkContent(
      'First paragraph with enough words to pass the length gate.\n\nshort\n\nSecond paragraph that also clears the minimum length bar.',
    );
    expect(chunks.map((c) => c.index)).toEqual([0, 1]);
    expect(chunks[0].text).toContain('First paragraph');
    expect(chunks[1].text).toContain('Second paragraph');
  });

  it('strips frontmatter and fenced code before chunking', () => {
    const md = [
      '---', 'title: x', 'tags: [a]', '---', '',
      '```ts', 'const thisCodeShouldNotEmbed = true;', '```', '',
      'Only this prose paragraph should survive into the chunk list.',
    ].join('\n');
    const chunks = chunkContent(md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain('Only this prose paragraph');
    expect(chunks.some((c) => c.text.includes('thisCodeShouldNotEmbed'))).toBe(false);
    expect(chunks.some((c) => c.text.includes('title: x'))).toBe(false);
  });

  it('drops heading markers and caps text/preview lengths', () => {
    const long = 'word '.repeat(200).trim();
    const chunks = chunkContent(`## A heading paragraph long enough to keep\n\n${long}`);
    expect(chunks[0].text.startsWith('A heading paragraph')).toBe(true);
    expect(chunks[1].text.length).toBeLessThanOrEqual(600);
    expect(chunks[1].preview.length).toBeLessThanOrEqual(141);
    expect(chunks[1].preview.endsWith('…')).toBe(true);
  });

  it('returns nothing for code-only documents', () => {
    expect(chunkContent('```js\nconsole.log(1);\n```')).toEqual([]);
  });
});
