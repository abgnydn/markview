import { describe, it, expect } from 'vitest';
import { expandTransclusions, extractSection, hasTransclusion } from '@/lib/markdown/transclude';

const NOTES: Record<string, string> = {
  intro: '# Intro\nWelcome.\n\n## Details\nThe details.\n\n## Other\nElse.',
  loop: 'before ![[loop]] after',
  uses: 'see ![[intro#Details]] done',
};
const resolve = async (name: string, heading?: string) => {
  const md = NOTES[name.toLowerCase()];
  if (md == null) return null;
  return heading ? extractSection(md, heading) : md;
};

describe('transclusion', () => {
  it('detects ![[...]] but not plain [[...]]', () => {
    expect(hasTransclusion('a ![[x]] b')).toBe(true);
    expect(hasTransclusion('a [[x]] b')).toBe(false);
  });

  it('embeds a whole note', async () => {
    const out = await expandTransclusions('Top\n![[intro]]\nBottom', resolve);
    expect(out).toContain('# Intro');
    expect(out).toContain('The details.');
    expect(out.startsWith('Top')).toBe(true);
    expect(out.trimEnd().endsWith('Bottom')).toBe(true);
  });

  it('embeds a single section via #heading', async () => {
    const out = await expandTransclusions('![[intro#Details]]', resolve);
    expect(out).toContain('## Details');
    expect(out).toContain('The details.');
    expect(out).not.toContain('Welcome.');
    expect(out).not.toContain('## Other');
  });

  it('expands nested transclusions', async () => {
    const out = await expandTransclusions('![[uses]]', resolve);
    expect(out).toContain('The details.');
  });

  it('guards against cycles', async () => {
    const out = await expandTransclusions('![[loop]]', resolve);
    expect(out).toContain('circular embed');
  });

  it('flags a missing note', async () => {
    const out = await expandTransclusions('![[nope]]', resolve);
    expect(out).toContain('Embedded note not found: nope');
  });
});
