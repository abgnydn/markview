import { renderMarkdown, extractHeadings, type TocHeading } from '@markview/core';

// ─── Shiki Singleton ──────────────────────────────────────────────────────────

let shikiHighlighter: Awaited<ReturnType<typeof import('shiki')['createHighlighter']>> | null = null;
let shikiPromise: Promise<void> | null = null;
let shikiFailed = false;

async function ensureShiki() {
  if (shikiHighlighter || shikiFailed) return;
  if (shikiPromise) { await shikiPromise; return; }
  shikiPromise = (async () => {
    try {
      const { createHighlighter } = await import('shiki');
      shikiHighlighter = await createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: [
          'javascript', 'typescript', 'python', 'bash', 'shell', 'json', 'yaml', 'html', 'css',
          'jsx', 'tsx', 'sql', 'go', 'rust', 'java', 'c', 'cpp', 'ruby', 'php', 'swift',
          'kotlin', 'markdown', 'xml', 'toml', 'ini', 'dockerfile', 'graphql', 'diff',
        ],
      });
    } catch (e) {
      console.warn('Shiki failed to load:', e);
      shikiFailed = true;
    }
  })();
  await shikiPromise;
}

// ─── Mermaid Singleton ────────────────────────────────────────────────────────

let mermaidModule: typeof import('mermaid')['default'] | null = null;
let mermaidPromise: Promise<typeof import('mermaid')['default']> | null = null;

async function ensureMermaid() {
  if (mermaidModule) return mermaidModule;
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import('mermaid').then((m) => { mermaidModule = m.default; return m.default; });
  return mermaidPromise;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  // Decode &amp; LAST to prevent double-decoding (e.g. &amp;lt; → &lt; → <)
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function escapeForAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function createCodeBlockWrapper(lang: string, preHtml: string, rawCode: string): string {
  return `<div class="code-block-wrapper" data-code="${escapeForAttr(rawCode)}">
    <div class="code-block-toolbar">
      <span class="code-block-lang">${lang}</span>
      <button class="code-copy-btn" title="Copy code" data-copy-code>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
      </button>
    </div>
    ${preHtml}
  </div>`;
}

function highlightHtml(html: string, theme: 'dark' | 'light'): string {
  if (!shikiHighlighter) return html;
  const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light';
  return html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (match, lang, code) => {
      if (lang === 'mermaid') return match;
      const decoded = decodeEntities(code);
      try {
        const loadedLangs = shikiHighlighter!.getLoadedLanguages();
        if (!loadedLangs.includes(lang as never)) return createCodeBlockWrapper(lang, match, decoded);
        const highlighted = shikiHighlighter!.codeToHtml(decoded, { lang, theme: shikiTheme });
        return createCodeBlockWrapper(lang, highlighted, decoded);
      } catch {
        return createCodeBlockWrapper(lang, match, decoded);
      }
    }
  );
}

async function renderMermaidInHtml(html: string, theme: 'dark' | 'light'): Promise<string> {
  if (!html.includes('language-mermaid')) return html;
  try {
    const mermaid = await ensureMermaid();
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      suppressErrorRendering: true,
    });
    let counter = 0;
    const regex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
    const replacements: { match: string; replacement: string }[] = [];
    let m;
    while ((m = regex.exec(html)) !== null) {
      const code = decodeEntities(m[1]);
      const id = `mermaid-${Date.now()}-${counter++}`;
      try {
        const { svg } = await mermaid.render(id, code.trim());
        replacements.push({ match: m[0], replacement: `<div class="mermaid-wrapper">${svg}</div>` });
      } catch (e) {
        console.warn('Mermaid render error:', e);
        const orphan = document.getElementById(id);
        if (orphan) orphan.remove();
      }
    }
    for (const r of replacements) html = html.replace(r.match, r.replacement);
  } catch (e) {
    console.warn('Mermaid failed to load:', e);
  }
  return html;
}

// ─── Custom Element ───────────────────────────────────────────────────────────

/**
 * `<mark-view>` — A Web Component for rendering markdown.
 *
 * @example
 * ```html
 * <script type="module">
 *   import '@markview/webcomponent';
 * </script>
 *
 * <mark-view
 *   content="# Hello World"
 *   theme="dark"
 *   shiki
 *   mermaid
 *   katex
 * ></mark-view>
 * ```
 *
 * @attr {string} content - Markdown content to render
 * @attr {'dark'|'light'|'auto'} theme - Color theme (default: 'auto')
 * @attr {boolean} shiki - Enable syntax highlighting
 * @attr {boolean} mermaid - Enable diagrams
 * @attr {boolean} katex - Enable math equations
 *
 * @fires headings-change - When headings are extracted (detail: TocHeading[])
 * @fires render-complete - When rendering is done (detail: string html)
 */
export class MarkViewElement extends HTMLElement {
  static get observedAttributes() {
    return ['content', 'theme', 'shiki', 'mermaid', 'katex'];
  }

  private _shadow: ShadowRoot;
  private _container: HTMLDivElement;
  private _styleEl: HTMLStyleElement;
  private _content = '';
  private _rendering = false;
  private _pendingRender = false;

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });

    this._styleEl = document.createElement('style');
    this._styleEl.textContent = `
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
      .markview-wc-content {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
        line-height: 1.6;
        color: var(--mv-text, #e4e4e7);
      }
    `;

    this._container = document.createElement('div');
    this._container.className = 'markview-wc-content';

    this._shadow.appendChild(this._styleEl);
    this._shadow.appendChild(this._container);
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue !== newValue) {
      this._render();
    }
  }

  // ── Properties ────────────────────────────────────────────────────────

  get content(): string { return this.getAttribute('content') || ''; }
  set content(val: string) { this.setAttribute('content', val); }

  get theme(): 'dark' | 'light' | 'auto' {
    return (this.getAttribute('theme') as 'dark' | 'light' | 'auto') || 'auto';
  }
  set theme(val: 'dark' | 'light' | 'auto') { this.setAttribute('theme', val); }

  // ── Rendering ─────────────────────────────────────────────────────────

  private _resolveTheme(): 'dark' | 'light' {
    const t = this.theme;
    if (t !== 'auto') return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private async _render() {
    if (this._rendering) {
      this._pendingRender = true;
      return;
    }

    this._rendering = true;
    const content = this.content;
    if (!content) {
      this._container.innerHTML = '';
      this._rendering = false;
      return;
    }

    const resolved = this._resolveTheme();
    const enableShiki = this.hasAttribute('shiki');
    const enableMermaid = this.hasAttribute('mermaid');
    const enableKatex = this.hasAttribute('katex');

    try {
      let html = await renderMarkdown(content);

      if (enableShiki) {
        await ensureShiki();
        html = highlightHtml(html, resolved);
      }

      if (enableMermaid) {
        html = await renderMermaidInHtml(html, resolved);
      }

      this._container.innerHTML = html;

      // KaTeX post-processing
      if (enableKatex) {
        await this._renderKatex();
      }

      // Wire up code copy buttons
      this._wireCodeCopy();

      // Wire up table sorting
      this._wireTableSort();

      // Emit events
      const headings = extractHeadings(html);
      this.dispatchEvent(new CustomEvent('headings-change', { detail: headings, bubbles: true }));
      this.dispatchEvent(new CustomEvent('render-complete', { detail: html, bubbles: true }));

    } catch (e) {
      console.warn('MarkView render error:', e);
      const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const fallback = await renderMarkdown(content).catch(() => `<pre>${escaped}</pre>`);
      this._container.innerHTML = fallback;
    }

    this._rendering = false;
    if (this._pendingRender) {
      this._pendingRender = false;
      this._render();
    }
  }

  private _wireCodeCopy() {
    this._container.querySelectorAll('[data-copy-code]').forEach((btn) => {
      const wrapper = btn.closest('.code-block-wrapper') as HTMLElement;
      if (!wrapper) return;
      const code = wrapper.dataset.code || '';
      (btn as HTMLButtonElement).onclick = () => {
        navigator.clipboard.writeText(decodeEntities(code)).then(() => {
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
            btn.classList.remove('copied');
          }, 2000);
        });
      };
    });
  }

  private _wireTableSort() {
    this._container.querySelectorAll('table thead th').forEach((th, colIdx) => {
      if ((th as HTMLElement).dataset.sortable === 'true') return;
      (th as HTMLElement).dataset.sortable = 'true';
      (th as HTMLElement).style.cursor = 'pointer';
      (th as HTMLElement).title = 'Click to sort';
      let ascending = true;
      th.addEventListener('click', () => {
        const table = th.closest('table');
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
          const aText = a.children[colIdx]?.textContent?.trim() || '';
          const bText = b.children[colIdx]?.textContent?.trim() || '';
          const aNum = parseFloat(aText);
          const bNum = parseFloat(bText);
          if (!isNaN(aNum) && !isNaN(bNum)) return ascending ? aNum - bNum : bNum - aNum;
          return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
        });
        rows.forEach((row) => tbody.appendChild(row));
        ascending = !ascending;
        table.querySelectorAll('th').forEach((h) => h.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(ascending ? 'sorted-desc' : 'sorted-asc');
      });
    });
  }

  private async _renderKatex() {
    try {
      const katex = (await import('katex')).default;

      this._container.querySelectorAll('code').forEach((code) => {
        const text = code.textContent || '';
        if (text.startsWith('$$') && text.endsWith('$$')) {
          const mathText = text.slice(2, -2).trim();
          const wrapper = document.createElement('div');
          wrapper.className = 'katex-block';
          try {
            katex.render(mathText, wrapper, { displayMode: true, throwOnError: false });
            const parent = code.closest('pre') || code;
            parent.replaceWith(wrapper);
          } catch { /* keep original */ }
        }
      });

      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          if (!text.includes('$')) return;
          const regex = /\$([^$\n]+?)\$/g;
          let match;
          const frag = document.createDocumentFragment();
          let lastIndex = 0;
          let found = false;
          while ((match = regex.exec(text)) !== null) {
            found = true;
            if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            const span = document.createElement('span');
            span.className = 'katex-inline';
            try { katex.render(match[1], span, { displayMode: false, throwOnError: false }); }
            catch { span.textContent = match[0]; }
            frag.appendChild(span);
            lastIndex = regex.lastIndex;
          }
          if (found) {
            if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
            node.parentNode?.replaceChild(frag, node);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.classList.contains('katex')) return;
          Array.from(node.childNodes).forEach(walk);
        }
      };
      walk(this._container);
    } catch (e) {
      console.warn('KaTeX failed to load:', e);
    }
  }
}

// Register the custom element
if (typeof customElements !== 'undefined' && !customElements.get('mark-view')) {
  customElements.define('mark-view', MarkViewElement);
}

/** Preload Shiki highlighter for faster first render */
export function preloadShiki() { ensureShiki(); }

export type { TocHeading };
