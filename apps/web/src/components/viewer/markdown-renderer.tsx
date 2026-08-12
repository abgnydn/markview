
import React, { useEffect, useRef, useState, startTransition } from 'react';
import { renderMarkdown, extractHeadings, type TocHeading } from '@/lib/markdown/pipeline';
import { createCodeBlockWrapper, decodeHtmlEntities, DEFAULT_SHIKI_LANGS } from '@markview/core';
import { expandTransclusions, hasTransclusion, type TranscludeResolver } from '@/lib/markdown/transclude';
import { expandWikilinks } from '@/lib/markdown/wikilinks';
import { useThemeStore } from '@/stores/theme-store';
import { usePluginStore } from '@/lib/plugins/plugin-registry';
import '@/lib/plugins/embed-plugin';
import { DOM_ENHANCERS } from '@/lib/markdown/dom-enhancers';
// Type-only imports — erased at compile time, so shiki/mermaid stay lazy.
import type { createHighlighter } from 'shiki';
import type MermaidDefault from 'mermaid';

interface MarkdownRendererProps {
  content: string;
  onHeadingsChange?: (headings: TocHeading[]) => void;
  onHtmlRendered?: (html: string) => void;
  onNavigateToFile?: (filename: string) => void;
  workspaceFiles?: string[]; // filenames for link validation
  /** Make task-list checkboxes interactive — called with the 0-based index
      of the toggled checkbox (document order) and its new state. */
  onToggleTask?: (index: number, checked: boolean) => void;
  /** Resolve `![[note]]` / `![[note#heading]]` transclusions to markdown. */
  resolveTransclusion?: TranscludeResolver;
}


// Shiki highlighter singleton
let shikiHighlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;
let shikiPromise: Promise<void> | null = null;

let shikiFailed = false;

async function ensureShiki() {
  if (shikiHighlighter || shikiFailed) return;
  if (shikiPromise) {
    await shikiPromise;
    return;
  }
  shikiPromise = (async () => {
    try {
      const { createHighlighter } = await import('shiki');
      shikiHighlighter = await createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: DEFAULT_SHIKI_LANGS,
      });
    } catch (e) {
      console.warn('Shiki failed to load (CSP or env issue), using plain code blocks:', e);
      shikiFailed = true;
    }
  })();
  await shikiPromise;
}


// Mermaid singleton — avoid re-importing on every render
let mermaidModule: typeof MermaidDefault | null = null;
let mermaidPromise: Promise<typeof MermaidDefault> | null = null;

async function ensureMermaid() {
  if (mermaidModule) return mermaidModule;
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import('mermaid').then((m) => {
    mermaidModule = m.default;
    return m.default;
  });
  return mermaidPromise;
}

/** Yield to the browser to prevent long-task INP violations */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Drop the `disabled` attribute GFM puts on task-list checkboxes, so they
 * are interactive in the markup ITSELF.
 *
 * This used to be done by flipping `box.disabled = false` in an effect,
 * which silently stopped working: React re-applies `dangerouslySetInnerHTML`
 * on a later re-commit (the html is set inside `startTransition`), which
 * rebuilds the inputs from this string — attribute still present — while
 * the effect does not re-run because its deps never changed. Fixing the
 * string means any number of re-applications stay enabled.
 *
 * Scoped to `li.task-list-item` so a raw `<input disabled>` a user wrote
 * by hand keeps its own semantics.
 */
function enableTaskCheckboxes(html: string): string {
  return html.replace(
    /(<li class="task-list-item">\s*<input\b[^>]*?)\s+disabled(\s*\/?>)/g,
    '$1$2',
  );
}

function highlightHtml(html: string, theme: 'dark' | 'light'): string {
  if (!shikiHighlighter) return html;

  const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light';

  // Find code blocks and replace with highlighted versions
  return html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (match, lang, code) => {
      if (lang === 'mermaid') return match; // Skip mermaid blocks — rendered separately

      // Check for registered plugin
      const plugin = usePluginStore.getState().getPlugin(lang);
      if (plugin) {
        const decoded = decodeHtmlEntities(code);
        try {
          return plugin.render(decoded, theme);
        } catch {
          return match; // fallback to raw code
        }
      }

      const decoded = decodeHtmlEntities(code);

      const highlighter = shikiHighlighter;
      if (!highlighter) {
        return createCodeBlockWrapper(lang, match, decoded);
      }
      try {
        const loadedLangs = highlighter.getLoadedLanguages();
        if (!loadedLangs.includes(lang as never)) {
          // Return with wrapper but no highlighting
          return createCodeBlockWrapper(lang, match, decoded);
        }
        const highlighted = highlighter.codeToHtml(decoded, {
          lang,
          theme: shikiTheme,
        });
        return createCodeBlockWrapper(lang, highlighted, decoded);
      } catch {
        return createCodeBlockWrapper(lang, match, decoded);
      }
    }
  );
}

// Render mermaid diagrams in the HTML string (before React gets it)
async function renderMermaidInHtml(html: string, theme: 'dark' | 'light'): Promise<string> {
  // Quick check: if no mermaid blocks, skip mermaid import entirely
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

    // Collect all mermaid blocks
    let m;
    while ((m = regex.exec(html)) !== null) {
      const encoded = m[1];
      const code = decodeHtmlEntities(encoded);

      const id = `mermaid-${Date.now()}-${counter++}`;

      try {
        const { svg } = await mermaid.render(id, code.trim());
        replacements.push({
          match: m[0],
          replacement: `<div class="mermaid-wrapper">
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
        console.warn('Mermaid render error for block:', e);
        // Clean up orphaned SVG
        const orphan = document.getElementById(id);
        if (orphan) orphan.remove();
        // Push a passthrough entry so the sequential replace below stays
        // aligned — otherwise one failed diagram shifts every following
        // diagram into the wrong slot and drops the last one.
        replacements.push({ match: m[0], replacement: m[0] });
      }
    }

    // Apply replacements in order (index counter avoids re-replacing the same
    // match when two mermaid blocks have identical source)
    let replIdx = 0;
    html = html.replace(
      /\<pre\>\<code class="language-mermaid"\>[\s\S]*?\<\/code\>\<\/pre\>/g,
      () => {
        const r = replacements[replIdx++];
        return r ? r.replacement : '';
      }
    );
  } catch (e) {
    console.warn('Mermaid failed to load:', e);
  }

  return html;
}


export function MarkdownRenderer({ content, onHeadingsChange, onHtmlRendered, onNavigateToFile, workspaceFiles, onToggleTask, resolveTransclusion }: MarkdownRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const resolved = useThemeStore((s) => s.resolved);

  // Render markdown + highlight with Shiki
  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      try {
        // Expand `![[note]]` / `![[note#heading]]` transclusions into the
        // embedded markdown FIRST — before the wikilink pass below, which
        // would otherwise mangle the `[[...]]` inside `![[...]]`.
        let source = content;
        if (resolveTransclusion && hasTransclusion(source)) {
          source = await expandTransclusions(source, resolveTransclusion);
          if (cancelled) return;
        }

        // Expand `[[name]]` wikilinks into standard markdown links —
        // code-aware, so `[[...]]` inside fences/inline code stays verbatim.
        const preprocessed = expandWikilinks(source);

        // Render markdown
        const rawHtml = await renderMarkdown(preprocessed, {
          codeBlockToolbar: false,
          katex: true,
          alerts: true,
        });
        if (cancelled) return;

        // Ensure shiki is loaded (fails gracefully in extension context)
        await ensureShiki();
        if (cancelled) return;

        // Yield to browser before heavy sync work (prevents INP violations)
        await yieldToMain();
        if (cancelled) return;

        // Highlight code blocks in HTML string (sync, CPU-heavy)
        const highlighted = highlightHtml(rawHtml, resolved);

        // Yield again before mermaid rendering
        await yieldToMain();
        if (cancelled) return;

        // Render mermaid diagrams in the HTML string (before DOM)
        const withMermaid = await renderMermaidInHtml(highlighted, resolved);

        if (!cancelled) {
          const final = onToggleTask ? enableTaskCheckboxes(withMermaid) : withMermaid;
          // Use startTransition so this low-priority update doesn't block interactions
          startTransition(() => {
            setHtml(final);
          });
          onHtmlRendered?.(final);
        }
      } catch (e) {
        console.warn('Markdown processing error:', e);
        // Fallback: render raw markdown as-is
        if (!cancelled) {
          const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const rawHtml = await renderMarkdown(content).catch(() => `<pre>${escaped}</pre>`);
          startTransition(() => {
            setHtml(rawHtml);
          });
        }
      }
    };

    process();
    return () => { cancelled = true; };
  }, [content, resolved, resolveTransclusion]);

  // Extract headings after HTML is set
  useEffect(() => {
    if (html && onHeadingsChange) {
      const headings = extractHeadings(html);
      onHeadingsChange(headings);
    }
  }, [html, onHeadingsChange]);

  // Wire up copy buttons after HTML render
  useEffect(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;

    // Wire up copy buttons
    container.querySelectorAll('[data-copy-code]').forEach((btn) => {
      const wrapper = btn.closest('.code-block-wrapper') as HTMLElement;
      if (!wrapper) return;
      const code = wrapper.dataset.code || '';

      (btn as HTMLButtonElement).onclick = () => {
        const decoded = decodeHtmlEntities(code);

        navigator.clipboard.writeText(decoded).then(() => {
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

  // Wire up mermaid toolbar buttons (zoom, copy SVG, copy PNG)
  useEffect(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;

    const handleMermaidClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-mermaid-zoom], [data-mermaid-copy-svg], [data-mermaid-copy-png]') as HTMLElement;
      if (!btn) return;

      const wrapper = btn.closest('.mermaid-wrapper') as HTMLElement;
      if (!wrapper) return;

      const svgEl = wrapper.querySelector('svg:not(.mermaid-toolbar svg)') as SVGElement;
      if (!svgEl) return;

      // Zoom — fullscreen preview
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
            <div class="mermaid-preview-body">
              ${svgEl.outerHTML}
            </div>
          </div>
        `;

        const close = () => overlay.remove();
        overlay.querySelector('.mermaid-preview-close')?.addEventListener('click', close);
        overlay.addEventListener('click', (ev) => {
          if ((ev.target as HTMLElement).classList.contains('mermaid-preview-overlay')) close();
        });
        document.addEventListener('keydown', function handler(ev) {
          if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
        });

        // Enable zoom via scroll wheel
        let scale = 1;
        const previewBody = overlay.querySelector('.mermaid-preview-body') as HTMLElement;
        previewBody?.addEventListener('wheel', (ev) => {
          ev.preventDefault();
          scale = Math.max(0.25, Math.min(5, scale + (ev.deltaY > 0 ? -0.1 : 0.1)));
          const previewSvg = previewBody.querySelector('svg') as SVGElement;
          if (previewSvg) previewSvg.style.transform = `scale(${scale})`;
        }, { passive: false });

        document.body.appendChild(overlay);
      }

      // Copy SVG
      if (btn.hasAttribute('data-mermaid-copy-svg')) {
        e.stopPropagation();
        const svgMarkup = svgEl.outerHTML;
        navigator.clipboard.writeText(svgMarkup).then(() => {
          const span = btn.querySelector('span');
          if (span) { span.textContent = 'Copied!'; setTimeout(() => { span.textContent = 'SVG'; }, 1500); }
        });
      }

      // Copy PNG
      if (btn.hasAttribute('data-mermaid-copy-png')) {
        e.stopPropagation();
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 2; // 2x for retina
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext('2d')!;
          ctx.scale(scale, scale);
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

    container.addEventListener('click', handleMermaidClick);
    return () => container.removeEventListener('click', handleMermaidClick);
  }, [html]);

  // Inter-document linking + link validation
  useEffect(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a') as HTMLAnchorElement;
      if (!link) return;

      const href = link.getAttribute('href') || '';
      // Handle internal .md links
      if (href.match(/\.md(#.*)?$/i) && !href.startsWith('http')) {
        e.preventDefault();
        const basename = href.split('/').pop()?.split('#')[0] || '';
        if (onNavigateToFile) {
          onNavigateToFile(basename);
        }
      }
    };

    container.addEventListener('click', handleClick);

    // Link validation: mark broken internal links
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


  // Table sorting
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
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return ascending ? aNum - bNum : bNum - aNum;
          }
          return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText);
        });
        rows.forEach((row) => tbody.appendChild(row));
        ascending = !ascending;
        // Visual indicator
        table.querySelectorAll('th').forEach((h) => h.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(ascending ? 'sorted-desc' : 'sorted-asc');
      });
    });
  }, [html]);

  // ── Progressive-enhancement passes — scroll-reveal, margin footnotes,
  // ⌘-click fly-in, code collapse, image lightbox, heading anchors,
  // audio waveforms, external-link tooltips. Each is a self-contained
  // (root) => cleanup function in lib/markdown/dom-enhancers; we run
  // them all here and tear down on the next html change. (Extracted
  // from eight inline effects to keep this component focused.)
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const cleanups = DOM_ENHANCERS
      .map((fn) => fn(root))
      .filter((c): c is () => void => typeof c === 'function');
    return () => cleanups.forEach((c) => c());
  }, [html]);

  // Interactive task lists — report each toggle by its document-order index
  // so the host can flip the matching `- [ ]` / `- [x]` line in the source.
  //
  // The listener is DELEGATED to the stable container rather than bound per
  // checkbox: React rebuilds the inner subtree from the html string on
  // re-commit (see enableTaskCheckboxes), which would silently discard
  // per-element listeners without re-running this effect. Delegation and
  // the markup-level `disabled` removal together make toggling survive
  // any number of re-applications.
  const toggleRef = useRef(onToggleTask);
  toggleRef.current = onToggleTask;
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const onChange = (e: Event) => {
      const cb = toggleRef.current;
      if (!cb) return;
      const target = e.target as HTMLInputElement | null;
      if (!target || target.type !== 'checkbox') return;
      if (!target.closest('li.task-list-item')) return;
      const boxes = Array.from(
        root.querySelectorAll<HTMLInputElement>('li.task-list-item input[type="checkbox"]'),
      );
      const index = boxes.indexOf(target);
      if (index >= 0) cb(index, target.checked);
    };
    root.addEventListener('change', onChange);
    return () => root.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="markdown-content" ref={contentRef} style={{ fontSize: 'var(--content-font-size, 16px)' }}>
      {/* SECURITY: html is sanitized via rehype-sanitize in the rendering pipeline */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
