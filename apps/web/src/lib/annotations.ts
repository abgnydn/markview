// SPDX-License-Identifier: Apache-2.0

/**
 * Annotations storage + range re-anchoring.
 *
 * Annotations are stored in localStorage keyed by file id (cheap;
 * fits the workspace-per-browser model). Each note records the
 * selected text plus ~24 chars of context before/after — when the
 * file is opened later we search the rendered content for that
 * combination so notes survive small edits. If the anchor text moved
 * far enough that lookup fails, the note becomes "orphaned" and
 * lists at the bottom of the annotations panel.
 *
 * No backend, no CRDT. Power-user feature for solo workspaces.
 */

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink';

/** Highlight-label palette, shared by the toolbar, panel, and margin dots. */
export const ANNOTATION_COLORS: AnnotationColor[] = ['yellow', 'green', 'blue', 'pink'];
export const ANNOTATION_COLOR_MAP: Record<AnnotationColor, string> = {
  yellow: '#fef08a',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
};

export interface Annotation {
  id: string;
  fileId: string;
  /** Exact text the user selected. */
  anchorText: string;
  /** ~24 chars immediately before the selection. */
  contextBefore: string;
  /** ~24 chars immediately after. */
  contextAfter: string;
  note: string;
  /** Highlight colour label. Older stored notes default to yellow. */
  color: AnnotationColor;
  createdAt: number;
}

const CONTEXT_LEN = 24;
const STORAGE_PREFIX = 'mv-annotations-';

export function loadAnnotations(fileId: string): Annotation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + fileId);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Annotation[]) : [];
  } catch { return []; }
}

export function saveAnnotations(fileId: string, list: Annotation[]) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_PREFIX + fileId, JSON.stringify(list)); } catch { /* quota */ }
}

/** Build an annotation from the current Selection over a root element. */
export function annotationFromSelection(
  fileId: string,
  root: Element,
  note: string,
  color: AnnotationColor = 'yellow',
): Annotation | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const anchorText = sel.toString().trim();
  if (!anchorText) return null;

  const fullText = root.textContent ?? '';
  const startIdx = locateInText(fullText, anchorText);
  const before = startIdx > 0
    ? fullText.slice(Math.max(0, startIdx - CONTEXT_LEN), startIdx)
    : '';
  const after = startIdx >= 0
    ? fullText.slice(startIdx + anchorText.length, startIdx + anchorText.length + CONTEXT_LEN)
    : '';

  return {
    id: cryptoId(),
    fileId,
    anchorText,
    contextBefore: normalizeWS(before),
    contextAfter: normalizeWS(after),
    note,
    color,
    createdAt: Date.now(),
  };
}

/** Back-fill a colour on annotations loaded from older storage. */
export function withDefaultColor(list: Annotation[]): Annotation[] {
  return list.map((a) => (a.color ? a : { ...a, color: 'yellow' as AnnotationColor }));
}

/**
 * Find the DOM range that re-anchors an annotation inside `root`.
 * Walks text nodes building an offset table, then locates the
 * combination of (contextBefore + anchor + contextAfter) using a
 * tolerant whitespace match. Falls back to anchor-only if context
 * shifted (still useful, just less precise).
 *
 * Returns null when even the anchor text can't be found — annotation
 * is then marked orphan in the UI.
 */
export function reanchor(root: Element, a: Annotation): Range | null {
  const fullText = normalizeWS(root.textContent ?? '');
  const needle = normalizeWS(a.contextBefore + a.anchorText + a.contextAfter);
  let idx = needle ? fullText.indexOf(needle) : -1;
  const len = a.anchorText.length;
  let offset = a.contextBefore.length;
  if (idx === -1) {
    idx = fullText.indexOf(normalizeWS(a.anchorText));
    offset = 0;
    if (idx === -1) return null;
  }
  const target = idx + offset;
  return rangeAtOffset(root, target, len);
}

/** Build a DOM Range from a normalized-whitespace offset. */
function rangeAtOffset(root: Element, start: number, length: number): Range | null {
  const range = document.createRange();
  let remaining = start;
  let endRemaining = length;
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    const txt = normalizeWS(t.data);
    if (!startNode) {
      if (remaining <= txt.length) {
        startNode = t;
        startOff = mapNormalizedOffsetToRaw(t.data, remaining);
        endRemaining = length;
      } else {
        remaining -= txt.length;
        continue;
      }
    }
    if (startNode) {
      const here = startNode === t ? txt.length - startOff : txt.length;
      if (endRemaining <= here) {
        endNode = t;
        const fromOffset = startNode === t ? mapNormalizedOffsetToRaw(t.data, remaining + endRemaining) : mapNormalizedOffsetToRaw(t.data, endRemaining);
        endOff = fromOffset;
        break;
      } else {
        endRemaining -= here;
      }
    }
  }
  if (!startNode || !endNode) return null;
  try {
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    return range;
  } catch { return null; }
}

function mapNormalizedOffsetToRaw(raw: string, normIdx: number): number {
  let n = 0;
  for (let i = 0; i < raw.length; i++) {
    if (n === normIdx) return i;
    const c = raw[i]!;
    const prev = raw[i - 1] ?? '';
    if (/\s/.test(c) && /\s/.test(prev)) continue;
    n++;
  }
  return raw.length;
}

function normalizeWS(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function locateInText(haystack: string, needle: string): number {
  return normalizeWS(haystack).indexOf(normalizeWS(needle));
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
