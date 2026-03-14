'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { renderMarkdown, extractHeadings, type TocHeading } from '@/lib/markdown/pipeline';
import { useThemeStore } from '@/stores/theme-store';

interface MarkdownRendererProps {
  content: string;
  onHeadingsChange?: (headings: TocHeading[]) => void;
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

function highlightHtml(html: string, theme: 'dark' | 'light'): string {
  if (!shikiHighlighter) return html;

  const shikiTheme = theme === 'dark' ? 'github-dark' : 'github-light';

  // Find code blocks and replace with highlighted versions
  return html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (match, lang, code) => {
      if (lang === 'mermaid') return match; // Skip mermaid blocks

      // Decode HTML entities
      const decoded = code
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

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

export function MarkdownRenderer({ content, onHeadingsChange, onNavigateToFile, workspaceFiles }: MarkdownRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState('');
  const resolved = useThemeStore((s) => s.resolved);

  // Render markdown + highlight with Shiki
  useEffect(() => {
    let cancelled = false;

    const process = async () => {
      try {
        // Render markdown
        const rawHtml = await renderMarkdown(content);

        // Ensure shiki is loaded (fails gracefully in extension context)
        await ensureShiki();

        // Highlight code blocks in HTML string (before DOM)
        const highlighted = highlightHtml(rawHtml, resolved);

        if (!cancelled) {
          setHtml(highlighted);
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
        // Decode the stored code
        const decoded = code
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

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

  // Mermaid rendering (wrapped in try-catch for extension CSP compatibility)
  useEffect(() => {
    if (!contentRef.current || !html) return;
    const container = contentRef.current;

    const mermaidBlocks = container.querySelectorAll('code.language-mermaid');
    if (mermaidBlocks.length === 0) return; // Skip if no mermaid blocks

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: resolved === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, sans-serif',
        });

        for (let i = 0; i < mermaidBlocks.length; i++) {
          const block = mermaidBlocks[i];
          const pre = block.parentElement as HTMLPreElement;
          if (pre.dataset.mermaid === 'true') continue;

          const code = block.textContent || '';
          const id = `mermaid-${Date.now()}-${i}`;

          try {
            const { svg } = await mermaid.render(id, code);
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-wrapper';
            wrapper.innerHTML = svg;
            wrapper.dataset.mermaidSource = code;
            pre.replaceWith(wrapper);
          } catch (e) {
            console.warn('Mermaid render error:', e);
            pre.dataset.mermaid = 'true';
          }
        }
      } catch (e) {
        console.warn('Mermaid failed to load (CSP or env issue), showing raw code:', e);
      }
    };

    const timer = setTimeout(renderMermaid, 100);
    return () => clearTimeout(timer);
  }, [html, resolved]);

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
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
