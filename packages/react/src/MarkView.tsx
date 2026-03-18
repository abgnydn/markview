'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { renderMarkdown, extractHeadings, type TocHeading } from '@markview/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarkViewProps {
  /** Markdown content to render */
  content: string;
  /** Color theme for syntax highlighting and diagrams */
  theme?: 'dark' | 'light' | 'auto';
  /** Enable Shiki syntax highlighting (requires `shiki` peer dep) */
  shiki?: boolean;
  /** Enable Mermaid diagram rendering (requires `mermaid` peer dep) */
  mermaid?: boolean;
  /** Enable KaTeX math rendering (requires `katex` peer dep) */
  katex?: boolean;
  /** Additional CSS class name for the container */
  className?: string;
  /** Inline styles for the container */
  style?: React.CSSProperties;
  /** Callback when headings are extracted (for building a TOC) */
  onHeadingsChange?: (headings: TocHeading[]) => void;
  /** Callback with the rendered HTML string */
  onHtmlRendered?: (html: string) => void;
  /** Callback when an internal .md link is clicked */
  onNavigateToFile?: (filename: string) => void;
  /** List of filenames for link validation (marks broken links) */
  workspaceFiles?: string[];
}

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

/** Preload Shiki highlighter on app mount for faster first render */
export function preloadShiki() { ensureShiki(); }

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

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeForAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
        if (!loadedLangs.includes(lang as never)) {
          return createCodeBlockWrapper(lang, match, decoded);
        }
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
        const escapedSvg = svg.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        replacements.push({
          match: m[0],
          replacement: `<div class="mermaid-wrapper" data-mermaid-svg="${escapedSvg}">
            <div class="mermaid-toolbar">
              <button class="mermaid-btn" data-mermaid-zoom title="Expand diagram">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                <span>Zoom</span>
              </button>
              <button class="mermaid-btn" data-mermaid-copy-svg title="Copy as SVG">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                <span>SVG</span>
              </button>
              <button class="mermaid-btn" data-mermaid-copy-png title="Copy as PNG">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                <span>PNG</span>
              </button>
            </div>
            ${svg}
          </div>`,
        });
      } catch (e) {
        console.warn('Mermaid render error:', e);
        const orphan = document.getElementById(id);
        if (orphan) orphan.remove();
      }
    }

    for (const r of replacements) {
      html = html.replace(r.match, r.replacement);
    }
  } catch (e) {
    console.warn('Mermaid failed to load:', e);
  }

  return html;
}

// ─── Resolve theme ────────────────────────────────────────────────────────────

function resolveTheme(theme: 'dark' | 'light' | 'auto'): 'dark' | 'light' {
  if (theme !== 'auto') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * `<MarkView>` — A drop-in React component for rendering markdown.
 *
 * @example
 * ```tsx
 * import { MarkView } from '@markview/react';
 * import '@markview/core/styles';
 *
 * <MarkView content={markdown} theme="dark" shiki mermaid katex />
 * ```
 */
export function MarkView({
  content,
  theme = 'auto',
  shiki: enableShiki = false,
  mermaid: enableMermaid = false,
  katex: enableKatex = false,
  className,
  style,
  onHeadingsChange,
  onHtmlRendered,
  onNavigateToFile,
  workspaceFiles,
}: MarkViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const resolved = resolveTheme(theme);

  // ── Render pipeline ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      try {
        const rawHtml = await renderMarkdown(content);

        let processed = rawHtml;

        if (enableShiki) {
          await ensureShiki();
          processed = highlightHtml(processed, resolved);
        }

        if (enableMermaid) {
          processed = await renderMermaidInHtml(processed, resolved);
        }

        if (!cancelled) {
          setHtml(processed);
          onHtmlRendered?.(processed);
        }
      } catch (e) {
        console.warn('MarkView: render error:', e);
        if (!cancelled) {
          const fallback = await renderMarkdown(content).catch(() => `<pre>${content}</pre>`);
          setHtml(fallback);
        }
      }
    };

    process();
    return () => { cancelled = true; };
  }, [content, resolved, enableShiki, enableMermaid]);

  // ── Extract headings ────────────────────────────────────────────────────
  useEffect(() => {
    if (html && onHeadingsChange) {
      onHeadingsChange(extractHeadings(html));
    }
  }, [html, onHeadingsChange]);

  // ── Code copy buttons ───────────────────────────────────────────────────
  useEffect(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;

    container.querySelectorAll('[data-copy-code]').forEach((btn) => {
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
  }, [html]);

  // ── Mermaid toolbar ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentRef.current || !enableMermaid) return;
    const container = contentRef.current;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-mermaid-zoom], [data-mermaid-copy-svg], [data-mermaid-copy-png]') as HTMLElement;
      if (!btn) return;

      const wrapper = btn.closest('.mermaid-wrapper') as HTMLElement;
      if (!wrapper) return;
      const svgEl = wrapper.querySelector('svg:not(.mermaid-toolbar svg)') as SVGElement;
      if (!svgEl) return;

      if (btn.hasAttribute('data-mermaid-zoom')) {
        e.stopPropagation();
        const overlay = document.createElement('div');
        overlay.className = 'mermaid-preview-overlay';
        overlay.innerHTML = `
          <div class="mermaid-preview-container">
            <div class="mermaid-preview-header">
              <span>Diagram Preview</span>
              <button class="mermaid-preview-close" title="Close (Esc)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="mermaid-preview-body">${svgEl.outerHTML}</div>
          </div>`;

        const close = () => overlay.remove();
        overlay.querySelector('.mermaid-preview-close')?.addEventListener('click', close);
        overlay.addEventListener('click', (ev) => {
          if ((ev.target as HTMLElement).classList.contains('mermaid-preview-overlay')) close();
        });
        document.addEventListener('keydown', function handler(ev) {
          if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
        });

        let scale = 1;
        const body = overlay.querySelector('.mermaid-preview-body') as HTMLElement;
        body?.addEventListener('wheel', (ev) => {
          ev.preventDefault();
          scale = Math.max(0.25, Math.min(5, scale + (ev.deltaY > 0 ? -0.1 : 0.1)));
          const svg = body.querySelector('svg') as SVGElement;
          if (svg) svg.style.transform = `scale(${scale})`;
        }, { passive: false });

        document.body.appendChild(overlay);
      }

      if (btn.hasAttribute('data-mermaid-copy-svg')) {
        e.stopPropagation();
        navigator.clipboard.writeText(svgEl.outerHTML).then(() => {
          const span = btn.querySelector('span');
          if (span) { span.textContent = 'Copied!'; setTimeout(() => { span.textContent = 'SVG'; }, 1500); }
        });
      }

      if (btn.hasAttribute('data-mermaid-copy-png')) {
        e.stopPropagation();
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const s = 2;
          canvas.width = img.width * s;
          canvas.height = img.height * s;
          const ctx = canvas.getContext('2d')!;
          ctx.scale(s, s);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob((blob) => {
            if (blob) {
              navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
                const span = btn.querySelector('span');
                if (span) { span.textContent = 'Copied!'; setTimeout(() => { span.textContent = 'PNG'; }, 1500); }
              });
            }
          }, 'image/png');
        };
        img.src = url;
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [html, enableMermaid]);

  // ── Internal links + validation ─────────────────────────────────────────
  useEffect(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a') as HTMLAnchorElement;
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (href.match(/\.md(#.*)?$/i) && !href.startsWith('http')) {
        e.preventDefault();
        const basename = href.split('/').pop()?.split('#')[0] || '';
        onNavigateToFile?.(basename);
      }
    };

    container.addEventListener('click', handleClick);

    if (workspaceFiles && workspaceFiles.length > 0) {
      const lowerFiles = workspaceFiles.map(f => f.toLowerCase());
      container.querySelectorAll('a').forEach((link) => {
        const href = link.getAttribute('href') || '';
        if (href.match(/\.md(#.*)?$/i) && !href.startsWith('http')) {
          const basename = href.split('/').pop()?.split('#')[0]?.toLowerCase() || '';
          if (lowerFiles.includes(basename)) {
            link.classList.add('internal-link');
            link.classList.remove('broken-link');
          } else {
            link.classList.add('broken-link');
            link.classList.remove('internal-link');
            link.title = `File not found: ${basename}`;
          }
        }
      });
    }

    return () => container.removeEventListener('click', handleClick);
  }, [html, onNavigateToFile, workspaceFiles]);

  // ── KaTeX math ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentRef.current || !html || !enableKatex) return;
    const container = contentRef.current;

    const renderMath = async () => {
      try {
        const katex = (await import('katex')).default;

        container.querySelectorAll('code').forEach((code) => {
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
              if (match.index > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
              }
              const span = document.createElement('span');
              span.className = 'katex-inline';
              try {
                katex.render(match[1], span, { displayMode: false, throwOnError: false });
              } catch { span.textContent = match[0]; }
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
        walk(container);
      } catch (e) {
        console.warn('KaTeX failed to load:', e);
      }
    };

    const timer = setTimeout(renderMath, 200);
    return () => clearTimeout(timer);
  }, [html, enableKatex]);

  // ── Table sorting ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentRef.current || !html) return;
    const container = contentRef.current;

    container.querySelectorAll('table thead th').forEach((th, colIdx) => {
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
  }, [html]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`markview-content${className ? ` ${className}` : ''}`}
      ref={contentRef}
      style={style}
    >
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
