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
import { remarkInlineExtras } from './inline-extras';

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
    // SECURITY: 'style' intentionally NOT in the global allowlist —
    // it enables CSS overlay phishing (position:fixed full-viewport)
    // and is the largest XSS surface in user-supplied markdown.
    '*': ['className', 'id', 'title', 'lang', 'dir', 'data-*', 'aria-*', 'role'],
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
    // SECURITY: 'data:' intentionally NOT allowed for src — SVG data-URIs
    // can carry inline JavaScript that fires on render. If you need
    // inline images, encode them server-side and serve via http(s).
    // 'asset:' is a private scheme for local IndexedDB images — inert in the
    // DOM (the browser can't load it) until the resolveAssets enhancer swaps
    // it for an object URL, so it carries no XSS surface.
    src: ['http', 'https', 'asset'],
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
  // Pull-quote variant — no title row, magazine-style centered italic. The
  // remark visitor below skips the title prepend when className === alert-quote.
  QUOTE: { icon: '', label: 'Quote', className: 'alert-quote' },
};

const remarkAlerts: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const firstChild = node.children[0];
      if (firstChild?.type !== 'paragraph') return;

      const firstInline = (firstChild as Paragraph).children[0];
      if (firstInline?.type !== 'text') return;

      const text = (firstInline as Text).value;
      // Accept both [!NOTE] and [!note] — author convenience.
      const match = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|QUOTE)\]\s*\n?/i);
      if (!match) return;

      const alertType = match[1].toUpperCase();
      const config = ALERT_TYPES[alertType];
      if (!config) return;

      // Remove the alert marker from text
      (firstInline as Text).value = text.slice(match[0].length);

      // Convert blockquote to alert HTML
      const data = node.data || (node.data = {});
      data.hName = 'div';
      data.hProperties = {
        // hast types (bumped transitively) now require className as a list.
        className: ['gh-alert', config.className],
        'data-alert-type': alertType.toLowerCase(),
      };

      // Pull-quote variant has no title bar — the body IS the statement.
      if (alertType !== 'QUOTE') {
        (firstChild as Paragraph).children.unshift({
          type: 'html',
          value: `<div class="gh-alert-title"><span class="gh-alert-icon">${config.icon}</span> ${config.label}</div>`,
        } as never);
      }
    });
  };
};

// ---- Code Block Wrapper ----

export function createCodeBlockWrapper(lang: string, preHtml: string, rawCode: string): string {
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

export function decodeHtmlEntities(code: string): string {
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

export const DEFAULT_SHIKI_LANGS = [
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
      // shiki/core — the main 'shiki' entry statically references its
      // default oniguruma engine, which made bundlers emit 230 KB gz of
      // WASM chunks on behalf of anything importing this module, even
      // though this path always uses the JS engine.
      // @ts-ignore — shiki is an optional peer dependency
      const { createHighlighterCore } = await import('shiki/core');
      // @ts-ignore — same optional peer
      const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript');
      // @ts-ignore — same optional peer
      const { bundledThemes } = await import('shiki/themes');
      // @ts-ignore — same optional peer
      const { bundledLanguages } = await import('shiki/langs');
      const theme = config?.theme || 'github-dark';
      const themeNames = theme === 'github-dark'
        ? ['github-dark', 'github-light']
        : [theme, 'github-dark', 'github-light'];
      const langNames = config?.langs || DEFAULT_SHIKI_LANGS;
      const loadAll = async (map: Record<string, () => Promise<{ default: unknown }>>, names: string[]) =>
        (await Promise.all(names.filter((n) => map[n]).map(async (n) => (await map[n]()).default)));
      shikiHighlighter = await createHighlighterCore({
        themes: (await loadAll(bundledThemes, themeNames)) as never[],
        langs: (await loadAll(bundledLanguages, langNames)) as never[],
        engine: createJavaScriptRegexEngine({ forgiving: true }),
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
        // Passthrough entry keeps the sequential replace aligned when a
        // diagram fails — without it every following diagram shifts into
        // the wrong slot.
        replacements.push({ match: m[0], replacement: m[0] });
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

/**
 * Pull math out of markdown source BEFORE remark sees it. Two reasons:
 *   1. Markdown collapses `\\` (LaTeX row-break) into a single backslash.
 *   2. `&` (LaTeX column separator) gets HTML-escaped to `&amp;` after parse.
 * Either of those breaks KaTeX's ability to parse matrices, aligned, etc.
 * We swap each math span for a placeholder, run the pipeline, then KaTeX-
 * render the original source and put the HTML back where the placeholder is.
 */
interface MathExtract {
  content: string;
  blocks: Array<{ key: string; math: string; display: boolean }>;
}

function extractMath(content: string): MathExtract {
  const blocks: MathExtract['blocks'] = [];
  let counter = 0;

  // Split on fenced and inline code so we don't pull math out of code samples
  // (e.g. shell snippets that mention `$VAR`). Odd indices are code.
  const segments = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  const transformed = segments.map((seg, i) => {
    if (i % 2 === 1) return seg; // leave code alone

    // Block math first — $$...$$ (multi-line allowed).
    seg = seg.replace(/\$\$([\s\S]+?)\$\$/g, (_m, math) => {
      const key = `MATHBLOCK${counter++}KEY`;
      blocks.push({ key, math, display: true });
      return key;
    });

    // Inline math — $...$ on one line, no `$` or newline in body. Manual
    // scan instead of String.replace: when a match looks like currency
    // ("$5 for $"), the closing `$` we matched may actually be the OPENING
    // delimiter of a real math span right after it ("$5 for $x$"), so we
    // must resume scanning just past the `$digits`, not past the match.
    {
      const re = /\$([^\s$][^$\n]*?)\$/g;
      let out = '';
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(seg)) !== null) {
        if (/^\d/.test(m[1])) {
          const currency = /^\$\d+(?:[.,]\d+)*/.exec(m[0])![0];
          out += seg.slice(last, m.index) + currency;
          last = m.index + currency.length;
          re.lastIndex = last;
          continue;
        }
        const key = `MATHINLINE${counter++}KEY`;
        blocks.push({ key, math: m[1], display: false });
        out += seg.slice(last, m.index) + key;
        last = m.index + m[0].length;
      }
      seg = out + seg.slice(last);
    }

    return seg;
  });

  return { content: transformed.join(''), blocks };
}

// Entity-escape a math body for the un-rendered fallback. This text
// bypasses rehype-sanitize (extracted pre-sanitize, restored post-), so
// the fallback branch is the only thing standing between a hostile `$…$`
// and script execution.
function escapeMathHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function restoreMathInHtml(
  html: string,
  blocks: MathExtract['blocks']
): Promise<string> {
  if (blocks.length === 0) return html;

  try {
    // @ts-ignore — katex is an optional peer dependency
    const katexModule = (await import('katex')).default;

    for (const { key, math, display } of blocks) {
      let replacement: string;
      try {
        const rendered = katexModule.renderToString(math.trim(), {
          displayMode: display,
          throwOnError: false,
          output: 'html',
        });
        replacement = display
          ? `<div class="katex-block">${rendered}</div>`
          : `<span class="katex-inline">${rendered}</span>`;
      } catch {
        // Couldn't render — fall back to a code-styled sample so the user
        // sees something instead of a leaked placeholder.
        //
        // SECURITY: `math` is raw source pulled out BEFORE rehype-sanitize
        // and spliced back in AFTER it, so it is never sanitized. KaTeX
        // normally escapes it, but a non-ParseError (e.g. a RangeError from
        // deeply-nested `\frac`/superscripts blowing the parser stack) is
        // rethrown past `throwOnError:false` and lands here — so this branch
        // MUST escape the body itself or a `</code><img onerror=…>` breakout
        // executes on the viewer and in exported HTML.
        const safe = escapeMathHtml(display ? math.trim() : math);
        replacement = display
          ? `<pre><code>${safe}</code></pre>`
          : `<code>${safe}</code>`;
      }
      // Block math typically lands inside its own <p> (since the placeholder
      // word formed a paragraph). Replace <p>KEY</p> with the bare block so
      // a <div> doesn't end up nested inside a <p> (invalid HTML).
      if (display) {
        const wrapped = `<p>${key}</p>`;
        if (html.includes(wrapped)) {
          html = html.split(wrapped).join(replacement);
          continue;
        }
        // $$…$$ used mid-paragraph: the placeholder shares a <p> with other
        // text. A <div> here would make the browser auto-close the <p> and
        // split the paragraph — use a span (block styling comes from the
        // class, which is element-agnostic).
        html = html.split(key).join(
          replacement
            .replace(/^<div class="katex-block">/, '<span class="katex-block">')
            .replace(/<\/div>$/, '</span>')
            .replace(/^<pre><code>/, '<code>')
            .replace(/<\/code><\/pre>$/, '</code>'),
        );
        continue;
      }
      // Plain string replace — keys are unique and contain no regex metas.
      html = html.split(key).join(replacement);
    }
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
  // Track assigned ids so duplicate heading text gets unique anchors
  // (`setup`, `setup-1`, …) and an emoji/punctuation-only heading still
  // gets a usable id instead of an empty one — otherwise TOC/anchor links
  // jump to the wrong heading or nowhere.
  const used = new Set<string>();
  let counter = 0;
  // Tolerate headings that already carry attributes (raw-HTML headings,
  // sanitizer-retained classes) — an attribute-less-only match would leave
  // them without an id and their TOC entries scrolling nowhere.
  return html.replace(/<(h[1-6])((?:\s[^>]*)?)>(.*?)<\/\1>/gs, (match, tag, attrs: string, inner) => {
    counter++;
    if (/\bid\s*=/i.test(attrs)) return match; // keep an existing anchor
    const text = stripHtmlTags(inner).trim();
    const base = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-') || `heading-${counter}`;
    let id = base;
    let n = 1;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
  });
}

// A unified() processor is immutable once built and reusable across any
// number of .process() calls, so cache one per (alerts, sanitize) combo
// instead of rebuilding the whole remark/rehype chain on every render —
// the rebuild dominated cost in the per-file export-site loop and on
// every keystroke-driven re-render.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processorCache = new Map<string, any>();
function getProcessor(alerts: boolean, sanitize: boolean) {
  const key = `${alerts}:${sanitize}`;
  const cached = processorCache.get(key);
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // singleTilde:false so `~x~` is left for the subscript rule below; only
  // `~~x~~` stays GFM strikethrough.
  let processor: any = unified()
    .use(remarkParse)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkInlineExtras);
  if (alerts) processor = processor.use(remarkAlerts);
  processor = processor.use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw);
  if (sanitize) processor = processor.use(rehypeSanitize, sanitizeSchema);
  processor = processor.use(rehypeStringify);
  processorCache.set(key, processor);
  return processor;
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

  // Pull math out of the markdown source before remark touches it. We swap
  // each $...$ / $$...$$ for a placeholder; KaTeX gets the original LaTeX
  // unmangled by remark's `\\` collapse + GFM `&` escaping.
  let mathBlocks: MathExtract['blocks'] = [];
  if (katexOpt) {
    const extracted = extractMath(content);
    content = extracted.content;
    mathBlocks = extracted.blocks;
  }

  // Reuse a cached processor for this (alerts, sanitize) combination.
  const processor = getProcessor(alerts, sanitize);

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

  // Restore math placeholders with KaTeX-rendered HTML.
  if (katexOpt) {
    html = await restoreMathInHtml(html, mathBlocks);
  }

  return html;
}
