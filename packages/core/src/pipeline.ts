import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { Root, Blockquote, Paragraph, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// ---- Types ----

export interface RenderOptions {
  /** Enable Shiki syntax highlighting. Pass an object for custom config. */
  shiki?: boolean | { theme?: string; langs?: string[] };
  /** Enable Mermaid diagram rendering. Pass an object for custom config. */
  mermaid?: boolean | { theme?: 'dark' | 'default' };
  /** Enable KaTeX math rendering. */
  katex?: boolean;
  /** Enable HTML sanitization (default: true). */
  sanitize?: boolean;
  /** Inject IDs into heading tags for anchor linking (default: true). */
  headingIds?: boolean;
  /** Enable GitHub-style alerts (default: true). */
  alerts?: boolean;
  /** Wrap code blocks with toolbar (copy button, language label). Default: true. */
  codeBlockToolbar?: boolean;
}

// ---- Sanitization Schema ----

const sanitizeSchema = {
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'textarea', 'select', 'meta', 'link'],
  tagNames: [
    // Block elements
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'br', 'hr',
    'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'picture', 'source',
    // Inline elements
    'a', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
    'small', 'abbr', 'cite', 'q', 'dfn', 'time', 'var', 'samp', 'kbd',
    // Media
    'img', 'video', 'audio',
    // Details/Summary
    'details', 'summary',
    // Ruby annotations
    'ruby', 'rt', 'rp',
    // Input (for task lists)
    'input',
    // Sections
    'section', 'article', 'aside', 'nav', 'header', 'footer', 'main',
  ],
  attributes: {
    '*': ['className', 'id', 'title', 'lang', 'dir', 'data-*', 'aria-*', 'role', 'style'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    video: ['src', 'poster', 'controls', 'width', 'height'],
    audio: ['src', 'controls'],
    source: ['src', 'type', 'media'],
    td: ['align', 'valign', 'colspan', 'rowspan'],
    th: ['align', 'valign', 'colspan', 'rowspan', 'scope'],
    ol: ['start', 'type', 'reversed'],
    li: ['value'],
    input: ['type', 'checked', 'disabled'],
    code: ['className'],
    pre: ['className'],
    time: ['datetime'],
    blockquote: ['cite'],
    q: ['cite'],
    abbr: ['title'],
    col: ['span'],
    colgroup: ['span'],
  },
  protocols: {
    href: ['http', 'https', 'mailto', '#'],
    src: ['http', 'https', 'data'],
    cite: ['http', 'https'],
  },
  allowComments: false,
  allowDoctypes: false,
};

// ---- GitHub-style Alerts Plugin ----

const ALERT_TYPES: Record<string, { icon: string; label: string; className: string }> = {
  NOTE: { icon: 'ℹ️', label: 'Note', className: 'alert-note' },
  TIP: { icon: '💡', label: 'Tip', className: 'alert-tip' },
  IMPORTANT: { icon: '❗', label: 'Important', className: 'alert-important' },
  WARNING: { icon: '⚠️', label: 'Warning', className: 'alert-warning' },
  CAUTION: { icon: '🔴', label: 'Caution', className: 'alert-caution' },
};

const remarkAlerts: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const firstChild = node.children[0];
      if (firstChild?.type !== 'paragraph') return;

      const firstInline = (firstChild as Paragraph).children[0];
      if (firstInline?.type !== 'text') return;

      const text = (firstInline as Text).value;
      const match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/);
      if (!match) return;

      const alertType = match[1];
      const config = ALERT_TYPES[alertType];
      if (!config) return;

      // Remove the alert marker from text
      (firstInline as Text).value = text.slice(match[0].length);

      // Convert blockquote to alert HTML
      const data = node.data || (node.data = {});
      data.hName = 'div';
      data.hProperties = {
        className: `gh-alert ${config.className}`,
        'data-alert-type': alertType.toLowerCase(),
      };

      // Prepend title
      (firstChild as Paragraph).children.unshift({
        type: 'html',
        value: `<div class="gh-alert-title"><span class="gh-alert-icon">${config.icon}</span> ${config.label}</div>`,
      } as never);
    });
  };
};

// ---- Code Block Wrapper ----

function createCodeBlockWrapper(lang: string, preHtml: string, rawCode: string): string {
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

// ---- HTML Entity Helpers ----

function decodeHtmlEntities(code: string): string {
  // Decode hex entities FIRST, then named entities, &amp; LAST to prevent double-decoding
  return code
    .replace(/&#x3C;/g, '<')
    .replace(/&#x3E;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// ---- Shiki Highlighting ----

let shikiHighlighter: unknown | null = null;
let shikiPromise: Promise<void> | null = null;
let shikiFailed = false;

const DEFAULT_SHIKI_LANGS = [
  'javascript', 'typescript', 'python', 'bash', 'shell', 'json', 'yaml', 'html', 'css',
  'jsx', 'tsx', 'sql', 'go', 'rust', 'java', 'c', 'cpp', 'ruby', 'php', 'swift',
  'kotlin', 'markdown', 'xml', 'toml', 'ini', 'dockerfile', 'graphql', 'diff',
];

async function ensureShiki(config?: { theme?: string; langs?: string[] }) {
  if (shikiHighlighter || shikiFailed) return;
  if (shikiPromise) {
    await shikiPromise;
    return;
  }
  shikiPromise = (async () => {
    try {
      // @ts-ignore — shiki is an optional peer dependency
      const { createHighlighter } = await import('shiki');
      const theme = config?.theme || 'github-dark';
      const themes = theme === 'github-dark'
        ? ['github-dark', 'github-light']
        : [theme, 'github-dark', 'github-light'];
      shikiHighlighter = await createHighlighter({
        themes,
        langs: config?.langs || DEFAULT_SHIKI_LANGS,
      });
    } catch (e) {
      console.warn('Shiki failed to load:', e);
      shikiFailed = true;
    }
  })();
  await shikiPromise;
}

function highlightHtml(html: string, theme: string, addToolbar: boolean): string {
  if (!shikiHighlighter) return html;

  const hl = shikiHighlighter as {
    getLoadedLanguages: () => string[];
    codeToHtml: (code: string, opts: { lang: string; theme: string }) => string;
  };

  return html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (match, lang, code) => {
      if (lang === 'mermaid') return match; // Skip mermaid — rendered separately

      const decoded = decodeHtmlEntities(code);

      try {
        const loadedLangs = hl.getLoadedLanguages();
        if (!loadedLangs.includes(lang)) {
          return addToolbar ? createCodeBlockWrapper(lang, match, decoded) : match;
        }
        const highlighted = hl.codeToHtml(decoded, { lang, theme });
        return addToolbar ? createCodeBlockWrapper(lang, highlighted, decoded) : highlighted;
      } catch {
        return addToolbar ? createCodeBlockWrapper(lang, match, decoded) : match;
      }
    }
  );
}

// ---- Mermaid Rendering ----

async function renderMermaidInHtml(html: string, theme: 'dark' | 'default'): Promise<string> {
  if (!html.includes('language-mermaid')) return html;

  try {
    // @ts-ignore — mermaid is an optional peer dependency
    const mermaidModule = (await import('mermaid')).default;
    mermaidModule.initialize({
      startOnLoad: false,
      theme,
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
      suppressErrorRendering: true,
    });

    let counter = 0;
    const regex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
    const replacements: { match: string; replacement: string }[] = [];

    let m;
    while ((m = regex.exec(html)) !== null) {
      const code = decodeHtmlEntities(m[1]);
      const id = `mermaid-${Date.now()}-${counter++}`;

      try {
        const { svg } = await mermaidModule.render(id, code.trim());
        replacements.push({
          match: m[0],
          replacement: `<div class="mermaid-wrapper">${svg}</div>`,
        });
      } catch (e) {
        console.warn('Mermaid render error for block:', e);
        // Try to clean up orphaned SVG in browser context
        if (typeof document !== 'undefined') {
          const orphan = document.getElementById(id);
          if (orphan) orphan.remove();
        }
      }
    }

    let replIdx = 0;
    html = html.replace(
      /\<pre\>\<code class="language-mermaid"\>[\s\S]*?\<\/code\>\<\/pre\>/g,
      () => {
        const r = replacements[replIdx++];
        return r ? r.replacement : replacements[replIdx - 1]?.match ?? '';
      }
    );
  } catch (e) {
    console.warn('Mermaid failed to load:', e);
  }

  return html;
}

// ---- KaTeX Rendering ----

async function renderKatexInHtml(html: string): Promise<string> {
  if (!html.includes('$')) return html;

  try {
    // @ts-ignore — katex is an optional peer dependency
    const katexModule = (await import('katex')).default;

    // Process block math: $$...$$
    html = html.replace(
      /<code>\$\$([\s\S]*?)\$\$<\/code>/g,
      (_match, math) => {
        try {
          const rendered = katexModule.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
          });
          return `<div class="katex-block">${rendered}</div>`;
        } catch {
          return _match;
        }
      }
    );

    // Process inline math: $...$
    html = html.replace(
      /\$([^$\n]+?)\$/g,
      (_match, math) => {
        // Skip if inside a code block
        try {
          const rendered = katexModule.renderToString(math, {
            displayMode: false,
            throwOnError: false,
          });
          return `<span class="katex-inline">${rendered}</span>`;
        } catch {
          return _match;
        }
      }
    );
  } catch (e) {
    console.warn('KaTeX failed to load:', e);
  }

  return html;
}

// ---- Heading ID Injection ----

/** Strip HTML tags iteratively (no backtracking risk). */
function stripHtmlTags(input: string): string {
  let result = '';
  let inTag = false;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '<') {
      inTag = true;
    } else if (input[i] === '>') {
      inTag = false;
    } else if (!inTag) {
      result += input[i];
    }
  }
  return result;
}

function injectHeadingIds(html: string): string {
  return html.replace(/\<(h[1-6])\>(.*?)\<\/\1\>/gs, (_match, tag, inner) => {
    const text = stripHtmlTags(inner).trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });
}

// ---- Main Pipeline ----

/**
 * Render markdown content to HTML with full GitHub-flavored markdown support
 * and optional Shiki, Mermaid, and KaTeX integration.
 *
 * @example
 * ```ts
 * import { renderMarkdown } from '@markview/core';
 *
 * // Basic rendering
 * const html = await renderMarkdown('# Hello World');
 *
 * // With all features
 * const html = await renderMarkdown(content, {
 *   shiki: true,
 *   mermaid: true,
 *   katex: true,
 * });
 * ```
 */
export async function renderMarkdown(
  content: string,
  options: RenderOptions = {}
): Promise<string> {
  const {
    shiki: shikiOpt = false,
    mermaid: mermaidOpt = false,
    katex: katexOpt = false,
    sanitize = true,
    headingIds = true,
    alerts = true,
    codeBlockToolbar = true,
  } = options;

  // Build the unified pipeline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor: any = unified()
    .use(remarkParse)
    .use(remarkGfm);

  if (alerts) {
    processor = processor.use(remarkAlerts);
  }

  processor = processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw);

  if (sanitize) {
    processor = processor.use(rehypeSanitize, sanitizeSchema);
  }

  processor = processor.use(rehypeStringify);

  const result = await processor.process(content);
  let html = String(result);

  // Inject heading IDs
  if (headingIds) {
    html = injectHeadingIds(html);
  }

  // Shiki syntax highlighting
  if (shikiOpt) {
    const shikiConfig = typeof shikiOpt === 'object' ? shikiOpt : {};
    await ensureShiki(shikiConfig);
    const theme = shikiConfig.theme || 'github-dark';
    html = highlightHtml(html, theme, codeBlockToolbar);
  } else if (codeBlockToolbar) {
    // Add code block wrappers even without Shiki
    html = html.replace(
      /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
      (match, lang, code) => {
        if (lang === 'mermaid') return match;
        const decoded = decodeHtmlEntities(code);
        return createCodeBlockWrapper(lang, match, decoded);
      }
    );
  }

  // Mermaid diagram rendering
  if (mermaidOpt) {
    const mermaidConfig = typeof mermaidOpt === 'object' ? mermaidOpt : {};
    const mermaidTheme = mermaidConfig.theme || 'default';
    html = await renderMermaidInHtml(html, mermaidTheme);
  }

  // KaTeX math rendering
  if (katexOpt) {
    html = await renderKatexInHtml(html);
  }

  return html;
}
