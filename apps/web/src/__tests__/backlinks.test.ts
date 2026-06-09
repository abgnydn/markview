import { describe, it, expect } from 'vitest';
import { findBacklinks, type BacklinkFile } from '@/lib/backlinks';

const target = { id: 't', displayName: 'Project Plan', filename: 'project-plan.md' };
const files: BacklinkFile[] = [
  { id: 'a', displayName: 'Notes', filename: 'notes.md', content: 'See [[Project Plan]] for details.' },
  { id: 'b', displayName: 'Embed', filename: 'embed.md', content: 'intro\n![[project-plan#Goals]]\noutro' },
  { id: 'c', displayName: 'Link', filename: 'link.md', content: 'A [the plan](project-plan.md) here.' },
  { id: 'd', displayName: 'Alias', filename: 'alias.md', content: 'via [[Project Plan|the plan]] yep' },
  { id: 'e', displayName: 'Unrelated', filename: 'unrelated.md', content: 'nothing to see' },
  { id: 't', displayName: 'Project Plan', filename: 'project-plan.md', content: 'self [[Project Plan]]' },
];

describe('findBacklinks', () => {
  it('finds wikilinks, transclusions, aliases, and markdown links', () => {
    const links = findBacklinks(target, files);
    const ids = links.map((l) => l.fileId).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
  });

  it('excludes the target itself and unrelated notes', () => {
    const links = findBacklinks(target, files);
    expect(links.find((l) => l.fileId === 't')).toBeUndefined();
    expect(links.find((l) => l.fileId === 'e')).toBeUndefined();
  });

  it('captures the line as a snippet', () => {
    const links = findBacklinks(target, files);
    expect(links.find((l) => l.fileId === 'a')?.snippet).toContain('See [[Project Plan]]');
  });
});
