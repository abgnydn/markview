import { describe, it, expect } from 'vitest';
import { splitSlides } from '@/lib/markdown/slide-split';

// Title (first h1/h2 text) of a slide, or a marker if the slide is headless.
const titleOf = (slide: string): string => {
  const doc = new DOMParser().parseFromString(`<div>${slide}</div>`, 'text/html');
  return doc.querySelector('h1, h2')?.textContent ?? '[headless]';
};

describe('splitSlides', () => {
  it('splits on top-level h1/h2 headings', () => {
    const s = splitSlides('<h1>One</h1><p>a</p><h2>Two</h2><p>b</p>');
    expect(s).toHaveLength(2);
    expect(s.map(titleOf)).toEqual(['One', 'Two']);
  });

  it('treats a thematic break (---) as an explicit slide boundary', () => {
    // Previously collapsed into ONE slide with stray <hr>s in the middle.
    const s = splitSlides('<p>first</p><hr><p>second</p><hr><p>third</p>');
    expect(s).toHaveLength(3);
    expect(s.join('')).not.toContain('<hr'); // the rule is a separator, not content
  });

  it('folds content preceding the first heading into that heading\'s slide', () => {
    // Previously emitted a headless orphan slide for the lead content.
    const s = splitSlides('<p>badges</p><h1>Title</h1><p>body</p><h1>Next</h1>');
    expect(s).toHaveLength(2);
    expect(s.map(titleOf)).toEqual(['Title', 'Next']);
    expect(s[0]).toContain('badges'); // lead content kept, not dropped
  });

  it('consumes a --- that sits between two heading slides (no stray hr)', () => {
    const s = splitSlides('<h1>A</h1><p>a</p><hr><h1>B</h1><p>b</p>');
    expect(s).toHaveLength(2);
    expect(s.map(titleOf)).toEqual(['A', 'B']);
    expect(s.join('')).not.toContain('<hr');
  });

  it('applies the fold rule per segment after a break', () => {
    // After the ---, "a2" precedes B's heading and folds into B's slide.
    const s = splitSlides('<h1>A</h1><p>a</p><hr><p>a2</p><h2>B</h2>');
    expect(s).toHaveLength(2);
    expect(s.map(titleOf)).toEqual(['A', 'B']);
    expect(s[1]).toContain('a2');
  });

  it('returns a single slide when there is nothing to split on', () => {
    expect(splitSlides('<p>para1</p><p>para2</p>')).toHaveLength(1);
  });

  it('never returns zero slides, even for empty/blank input', () => {
    expect(splitSlides('')).toHaveLength(1);
    expect(splitSlides('   ')).toHaveLength(1);
  });
});
