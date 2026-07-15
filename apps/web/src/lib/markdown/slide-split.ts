/**
 * Split rendered markdown HTML into presentation slides.
 *
 * Boundaries:
 *  - a top-level thematic break (`<hr>`, produced by `---` / `***` / `___`) is
 *    an explicit slide break — the reveal.js / Marp convention — and is itself
 *    dropped rather than shown;
 *  - a top-level `<h1>` / `<h2>` starts a new slide.
 *
 * Content that precedes a segment's first heading is folded into that heading's
 * slide instead of being emitted as a headless orphan. When there is nothing to
 * split on (no headings, no breaks), the whole document is one slide.
 */
export function splitSlides(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstElementChild!;
  const out: string[] = [];
  let cur = '';
  let started = false; // has this segment opened its first heading-led slide?
  const flush = () => { if (cur.trim()) out.push(cur); cur = ''; };
  Array.from(container.children).forEach((el) => {
    if (el.tagName === 'HR') { flush(); started = false; return; }
    if (el.tagName === 'H1' || el.tagName === 'H2') {
      if (started) flush(); else started = true;
      cur += el.outerHTML;
    } else cur += el.outerHTML;
  });
  flush();
  return out.length > 0 ? out : [`<div>${html}</div>`];
}
