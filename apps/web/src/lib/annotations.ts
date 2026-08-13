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

  // Context must be sliced from the SAME normalized string the located
  // index refers to — slicing the raw text at a normalized index grabs
  // text from the wrong place, and a trimmed boundary space would glue
  // context onto the anchor so reanchor's needle never matches. Only the
  // outer edges are trimmed, keeping the anchor-adjacent whitespace.
  const fullText = normalizeWS(root.textContent ?? '');
  const normAnchor = normalizeWS(anchorText);
  // Locate the anchor by the SELECTION'S normalized offset — a plain
  // indexOf always found the FIRST occurrence, so annotating the second
  // instance of a repeated phrase stored the first one's context.
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const preRaw = pre.toString();
  const preNorm = normalizeWS(preRaw);
  // A trailing space in the raw pre-text is collapsed into the single
  // boundary space that precedes the anchor in the normalized stream.
  const startIdx = preNorm.length + (preNorm.length > 0 && /\s$/.test(preRaw) ? 1 : 0);
  const before = startIdx > 0
    ? fullText.slice(Math.max(0, startIdx - CONTEXT_LEN), startIdx).replace(/^\s+/, '')
    : '';
  const after = startIdx >= 0
    ? fullText.slice(startIdx + normAnchor.length, startIdx + normAnchor.length + CONTEXT_LEN).replace(/\s+$/, '')
    : '';

  return {
    id: cryptoId(),
    fileId,
    anchorText,
    contextBefore: before,
    contextAfter: after,
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
  // Offsets/lengths are all in normalized space — rangeAtOffset maps them
  // back to raw DOM positions.
  const len = normalizeWS(a.anchorText).length;
  let offset = a.contextBefore.length;
  if (idx === -1) {
    idx = fullText.indexOf(normalizeWS(a.anchorText));
    offset = 0;
    if (idx === -1) return null;
  }
  const target = idx + offset;
  return rangeAtOffset(root, target, len);
}

/** Build a DOM Range from a normalized-whitespace offset.
 *
 * Walks every text node once, emitting the SAME normalized stream
 * normalizeWS produces on the concatenated text (runs of whitespace —
 * including across node boundaries — collapse to one space; leading
 * whitespace is skipped). The previous implementation normalized each
 * node independently, which dropped the boundary space between nodes and drifted
 * one character per paragraph.
 */
function rangeAtOffset(root: Element, start: number, length: number): Range | null {
  const end = start + length;
  let normPos = 0;          // normalized chars emitted so far
  let pendingSpace = false; // a collapsed space is owed before the next word char
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  outer: while ((n = walker.nextNode())) {
    const t = n as Text;
    const data = t.data;
    for (let i = 0; i < data.length; i++) {
      if (/\s/.test(data[i]!)) {
        if (normPos > 0) pendingSpace = true; // leading whitespace never emits
        continue;
      }
      if (pendingSpace) {
        // Emit the owed boundary space at normPos.
        if (startNode && normPos + 1 >= end) { endNode = t; endOff = i; break outer; }
        normPos++;
        pendingSpace = false;
      }
      if (!startNode && normPos >= start) { startNode = t; startOff = i; }
      normPos++; // this word character
      if (startNode && normPos >= end) { endNode = t; endOff = i + 1; break outer; }
    }
  }
  if (!startNode || !endNode) return null;
  try {
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    return range;
  } catch { return null; }
}

function normalizeWS(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID: () => string }).randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
