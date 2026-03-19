'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { renderMarkdown, extractHeadings, type TocHeading } from '@/lib/markdown/pipeline';
import { useThemeStore } from '@/stores/theme-store';
import { usePluginStore } from '@/lib/plugins/plugin-registry';
import '@/lib/plugins/embed-plugin';

interface MarkdownRendererProps {
  content: string;
  onHeadingsChange?: (headings: TocHeading[]) => void;
  onHtmlRendered?: (html: string) => void;
  onNavigateToFile?: (filename: string) => void;
  workspaceFiles?: string[]; // filenames for link validation
}

// Shiki highlighter singleton
let shikiHighlighter: Awaited<ReturnType<typeof import('shiki')['createHighlighter']>> | null = null;
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
        langs: [
          'javascript', 'typescript', 'python', 'bash', 'shell', 'json', 'yaml', 'html', 'css',
          'jsx', 'tsx', 'sql', 'go', 'rust', 'java', 'c', 'cpp', 'ruby', 'php', 'swift',
          'kotlin', 'markdown', 'xml', 'toml', 'ini', 'dockerfile', 'graphql', 'diff',
        ],
      });
    } catch (e) {
      console.warn('Shiki failed to load (CSP or env issue), using plain code blocks:', e);
      shikiFailed = true;
    }
  })();
  await shikiPromise;
}

/** Call on app mount to preload Shiki before first render */
export function preloadShiki() {
  ensureShiki();
}

// Mermaid singleton — avoid re-importing on every render
let mermaidModule: typeof import('mermaid')['default'] | null = null;
let mermaidPromise: Promise<typeof import('mermaid')['default']> | null = null;

async function ensureMermaid() {
  if (mermaidModule) return mermaidModule;
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import('mermaid').then((m) => {
    mermaidModule = m.default;
    return m.default;
  });
  return mermaidPromise;
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
        // Decode &amp; LAST to prevent double-decoding (e.g. &amp;lt; → &lt; → <)
        const decoded = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
        try {
          return plugin.render(decoded, theme);
        } catch {
          return match; // fallback to raw code
        }
      }

      // Decode HTML entities — &amp; LAST to prevent double-decoding
      const decoded = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');

      try {
        const loadedLangs = shikiHighlighter!.getLoadedLanguages();
        if (!loadedLangs.includes(lang as never)) {
          // Return with wrapper but no highlighting
          return createCodeBlockWrapper(lang, match, decoded);
        }
        const highlighted = shikiHighlighter!.codeToHtml(decoded, {
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
      // Decode &amp; LAST to prevent double-decoding
      const code = encoded
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');

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
        // Leave block as-is (will show as code)
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

function createCodeBlockWrapper(lang: string, preHtml: string, rawCode: string) {
  const escapedCode = rawCode
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return `<div class="code-block-wrapper" data-code="${escapedCode}">
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

export function MarkdownRenderer({ content, onHeadingsChange, onHtmlRendered, onNavigateToFile, workspaceFiles }: MarkdownRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const resolved = useThemeStore((s) => s.resolved);

  // Render markdown + highlight with Shiki
  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      try {
        // Render markdown
        const rawHtml = await renderMarkdown(content, { codeBlockToolbar: false });

        // Ensure shiki is loaded (fails gracefully in extension context)
        await ensureShiki();

        // Highlight code blocks in HTML string (before DOM)
        const highlighted = highlightHtml(rawHtml, resolved);

        // Render mermaid diagrams in the HTML string (before DOM)
        const withMermaid = await renderMermaidInHtml(highlighted, resolved);

        if (!cancelled) {
          setHtml(withMermaid);
          onHtmlRendered?.(withMermaid);
        }
      } catch (e) {
        console.warn('Markdown processing error:', e);
        // Fallback: render raw markdown as-is
        if (!cancelled) {
          const rawHtml = await renderMarkdown(content).catch(() => `<pre>${content}</pre>`);
          setHtml(rawHtml);
        }
      }
    };

    process();
    return () => { cancelled = true; };
  }, [content, resolved]);

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
        // Decode the stored code — &amp; LAST to prevent double-decoding
        const decoded = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');

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


  // KaTeX math rendering
  useEffect(() => {
    if (!contentRef.current || !html) return;
    const container = contentRef.current;

    const renderMath = async () => {
      try {
        const katex = (await import('katex')).default;

        // Process block math: $$...$$
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
            } catch (e) { /* keep original */ }
          }
        });

        // Process inline math in text nodes
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
              } catch (e) {
                span.textContent = match[0];
              }
              frag.appendChild(span);
              lastIndex = regex.lastIndex;
            }
            if (found) {
              if (lastIndex < text.length) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex)));
              }
              node.parentNode?.replaceChild(frag, node);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            // Skip code blocks and existing katex
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
  }, [html]);

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

  return (
    <div className="markdown-content" ref={contentRef} style={{ fontSize: 'var(--content-font-size, 16px)' }}>
      {/* SECURITY: html is sanitized via rehype-sanitize in the rendering pipeline */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
