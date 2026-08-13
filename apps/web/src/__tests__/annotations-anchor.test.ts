// @vitest-environment jsdom
// Anchor math for annotations — recently rewritten to work entirely in
// normalized-whitespace space after a raw/normalized index mismatch made
// context matching permanently dead (annotations on repeated phrases
// stuck to the first occurrence). These tests pin the fixed behavior.

import { describe, it, expect, beforeEach } from 'vitest';
import { annotationFromSelection, reanchor } from '@/lib/annotations';

function selectText(root: Element, needle: string, occurrence = 0): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const idx = (node.textContent ?? '').indexOf(needle);
    if (idx !== -1) {
      if (seen === occurrence) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + needle.length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      seen++;
    }
  }
  throw new Error(`needle not found: ${needle} (occurrence ${occurrence})`);
}

describe('annotation anchoring', () => {
  let root: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = `
      <main id="root">
        <p>The quick brown fox jumps over the lazy dog.</p>
        <p>Chapter two begins here with different words entirely.</p>
        <p>The quick brown fox appears again in this later paragraph.</p>
      </main>`;
    root = document.getElementById('root')!;
  });

  it('round-trips: create on a selection, reanchor to the same text', () => {
    selectText(root, 'Chapter two begins');
    const a = annotationFromSelection('f1', root, 'note');
    expect(a).not.toBeNull();
    const range = reanchor(root, a!);
    expect(range).not.toBeNull();
    expect(range!.toString().replace(/\s+/g, ' ')).toContain('Chapter two begins');
  });

  it('context disambiguates a repeated phrase (second occurrence stays second)', () => {
    selectText(root, 'quick brown fox', 1); // the LATER paragraph
    const a = annotationFromSelection('f1', root, 'note');
    expect(a).not.toBeNull();
    // Context should reference the later paragraph's surroundings.
    expect(a!.contextAfter).toContain('appears again');
    const range = reanchor(root, a!);
    expect(range).not.toBeNull();
    // The reanchored range must live in the third paragraph, not the first.
    const p = range!.startContainer.parentElement?.closest('p');
    expect(p?.textContent).toContain('appears again');
  });

  it('survives text inserted before the target', () => {
    selectText(root, 'Chapter two begins');
    const a = annotationFromSelection('f1', root, 'note')!;
    // Simulate an edit upstream of the anchor.
    root.querySelector('p')!.insertAdjacentHTML('beforebegin', '<p>A brand new opening paragraph pushed everything down.</p>');
    const range = reanchor(root, a);
    expect(range).not.toBeNull();
    expect(range!.toString().replace(/\s+/g, ' ')).toContain('Chapter two');
  });

  it('returns null when the anchored text is gone', () => {
    selectText(root, 'Chapter two begins');
    const a = annotationFromSelection('f1', root, 'note')!;
    root.innerHTML = '<p>Everything was rewritten; nothing survives.</p>';
    expect(reanchor(root, a)).toBeNull();
  });
});
