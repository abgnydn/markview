// SPDX-License-Identifier: Apache-2.0

/**
 * Selection format bubble — a small floating toolbar that appears above a
 * non-empty selection in the editor (bold / italic / strike / highlight /
 * code / link). mousedown is prevented so clicking it doesn't drop the
 * selection before the format applies.
 */

import { ViewPlugin, EditorView, type ViewUpdate } from '@codemirror/view';

interface BubbleButton { label: string; kind: string; title: string; cls?: string; }

const BUTTONS: BubbleButton[] = [
  { label: 'B', kind: 'bold', title: 'Bold (⌘B)', cls: 'is-bold' },
  { label: 'I', kind: 'italic', title: 'Italic (⌘I)', cls: 'is-italic' },
  { label: 'S', kind: 'strikethrough', title: 'Strikethrough (⌘⇧X)', cls: 'is-strike' },
  { label: 'H', kind: 'highlight', title: 'Highlight (⌘⇧H)' },
  { label: '</>', kind: 'code', title: 'Code (⌘E)' },
  { label: '🔗', kind: 'link', title: 'Link (⌘K)' },
];

export function createFormatBubble(apply: (view: EditorView, kind: string) => void) {
  return ViewPlugin.fromClass(
    class {
      dom: HTMLDivElement;
      constructor(readonly view: EditorView) {
        this.dom = document.createElement('div');
        this.dom.className = 'cm-format-bubble';
        for (const b of BUTTONS) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = `cm-format-bubble-btn${b.cls ? ' ' + b.cls : ''}`;
          el.textContent = b.label;
          el.title = b.title;
          el.addEventListener('mousedown', (e) => {
            e.preventDefault(); // keep the selection alive
            apply(view, b.kind);
            requestAnimationFrame(() => this.position());
          });
          this.dom.appendChild(el);
        }
        view.dom.appendChild(this.dom);
        this.position();
      }

      update(u: ViewUpdate) {
        if (u.selectionSet || u.geometryChanged || u.docChanged || u.focusChanged) this.position();
      }

      position() {
        const sel = this.view.state.selection.main;
        if (sel.empty || !this.view.hasFocus) {
          this.dom.style.display = 'none';
          return;
        }
        const from = this.view.coordsAtPos(sel.from);
        const to = this.view.coordsAtPos(sel.to);
        if (!from || !to) {
          this.dom.style.display = 'none';
          return;
        }
        const box = this.view.dom.getBoundingClientRect();
        this.dom.style.display = 'flex';
        this.dom.style.left = `${(from.left + to.right) / 2 - box.left}px`;
        this.dom.style.top = `${Math.min(from.top, to.top) - box.top}px`;
      }

      destroy() {
        this.dom.remove();
      }
    },
  );
}
