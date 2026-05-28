// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react';
import { renderMarkdown } from '@/lib/markdown/pipeline';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface CardsModeProps {
  /** Markdown source of the active file. */
  content: string;
  onClose: () => void;
}

interface Card {
  id: string;
  title: string;
  markdown: string;
}

/**
 * CardsMode — alternative view to the linear scroll. The current
 * document is split by H2 boundaries; one card per H2 fills the
 * viewport, navigated by arrow keys / space / wheel. Pre-H2 content
 * (lede paragraphs + the H1 itself) becomes the title card.
 *
 * Ken-Burns transitions: each card cross-fades + scales (0.97 → 1)
 * on enter, opposite on exit. Atmosphere (painting + particles) sits
 * untouched behind the cards so the swap reads as a focal change,
 * not a page navigation.
 *
 *   ←  ↑           previous card
 *   →  ↓  Space   next card
 *   Home / End     first / last
 *   Esc            close
 *
 * Wheel ↑↓ also navigates (debounced so a single trackpad scroll
 * advances one card, not twelve).
 */
export function CardsMode({ content, onClose }: CardsModeProps) {
  const activeFile = useWorkspaceStore((s) => {
    const id = s.activeFileId;
    return id ? s.files.find((f) => f.id === id) ?? null : null;
  });

  const cards = useMemo<Card[]>(() => splitByH2(content || ''), [content]);
  const [idx, setIdx] = useState(0);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [direction, setDirection] = useState<1 | -1>(1);
  const lastNavRef = useRef(0);

  // Clamp index when content changes.
  useEffect(() => { if (idx >= cards.length) setIdx(0); }, [cards.length, idx]);

  // Render the current card's markdown.
  useEffect(() => {
    let cancelled = false;
    const card = cards[idx];
    if (!card) { setRenderedHtml(''); return; }
    void renderMarkdown(card.markdown).then((html) => {
      if (!cancelled) setRenderedHtml(html);
    });
    return () => { cancelled = true; };
  }, [cards, idx]);

  // Keyboard nav.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault(); advance(1); break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault(); advance(-1); break;
        case 'Home':
          e.preventDefault(); setDirection(-1); setIdx(0); break;
        case 'End':
          e.preventDefault(); setDirection(1); setIdx(Math.max(0, cards.length - 1)); break;
        case 'Escape':
          e.preventDefault(); onClose(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, onClose]);

  // Wheel nav — one card per detent.
  const onWheel = (e: React.WheelEvent) => {
    const now = performance.now();
    if (now - lastNavRef.current < 480) return;
    const sign = e.deltaY > 12 ? 1 : e.deltaY < -12 ? -1 : 0;
    if (sign === 0) return;
    lastNavRef.current = now;
    advance(sign as 1 | -1);
  };

  const advance = (delta: 1 | -1) => {
    setDirection(delta);
    setIdx((i) => Math.max(0, Math.min(cards.length - 1, i + delta)));
  };

  if (cards.length === 0) {
    return (
      <div className="mv-cards-overlay" onClick={onClose}>
        <div className="mv-cards-empty">Nothing to deal — this doc has no sections yet.</div>
      </div>
    );
  }

  const card = cards[idx];

  return (
    <div className="mv-cards-overlay" onWheel={onWheel}>
      <div className="mv-cards-header">
        <span className="mv-cards-file">{activeFile?.displayName || 'untitled'}</span>
        <span className="mv-cards-spacer" />
        <button className="mv-cards-close" onClick={onClose} aria-label="Close cards mode (Esc)">esc</button>
      </div>

      <div className="mv-cards-stage">
        <article
          key={card?.id}
          className={`mv-card mv-card-enter-${direction === 1 ? 'right' : 'left'}`}
        >
          <div
            className="markdown-content mv-cards-body"
            // SECURITY: html is sanitized via rehype-sanitize in the pipeline
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </article>
      </div>

      <nav className="mv-cards-nav" aria-label="Card position">
        <button
          className="mv-cards-arrow"
          onClick={() => advance(-1)}
          disabled={idx === 0}
          aria-label="Previous card"
        >‹</button>
        <div className="mv-cards-pips">
          {cards.map((c, i) => (
            <button
              key={c.id}
              className={`mv-cards-pip${i === idx ? ' is-current' : ''}`}
              title={c.title || `Card ${i + 1}`}
              onClick={() => { setDirection(i >= idx ? 1 : -1); setIdx(i); }}
            />
          ))}
        </div>
        <span className="mv-cards-counter">
          {idx + 1} <span className="mv-cards-counter-sep">/</span> {cards.length}
        </span>
        <button
          className="mv-cards-arrow"
          onClick={() => advance(1)}
          disabled={idx === cards.length - 1}
          aria-label="Next card"
        >›</button>
      </nav>
    </div>
  );
}

/**
 * Split a markdown document by H2 boundaries. Pre-H2 content (lede +
 * the H1 itself) becomes the first card. Each subsequent card starts
 * at an H2 line and runs until the next H2 (or end of doc).
 *
 * Frontmatter is stripped — it's metadata, not reading content.
 *
 * If the doc has no H2 at all, returns a single card with the whole
 * thing. If the whole doc is empty post-frontmatter, returns [].
 */
function splitByH2(source: string): Card[] {
  const trimmedFm = source.replace(/^---\n[\s\S]*?\n---\n*/, '');
  if (!trimmedFm.trim()) return [];

  const lines = trimmedFm.split(/\r?\n/);
  const sections: Card[] = [];
  let buffer: string[] = [];
  let currentTitle = '';
  let inFence = false;
  let cardSeq = 0;

  const flush = () => {
    const md = buffer.join('\n').trim();
    if (md) {
      sections.push({
        id: `card-${cardSeq++}`,
        title: currentTitle,
        markdown: md,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    // Track code fences so an inside-fence "## " doesn't split.
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^## (?!#)/.test(line)) {
      flush();
      currentTitle = line.replace(/^##\s+/, '').trim();
    }
    buffer.push(line);
  }
  flush();

  return sections;
}
