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

// ---- Sanitization Schema ----
// Permissive schema: allows all GFM/HTML features but strips scripts & event handlers
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
    code: ['className'],  // for language-* classes
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
  // Allow data URIs for images (base64 images in markdown)
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

// ---- Pipeline ----
export async function renderMarkdown(content: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkAlerts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(content);

  let html = String(result);

  // Inject heading IDs directly into the HTML so they're in the DOM from first render
  html = html.replace(/<(h[1-6])>(.*?)<\/\1>/g, (match, tag, inner) => {
    // Strip HTML tags to get plain text for ID generation
    const text = inner.replace(/<[^>]*>/g, '').trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });

  return html;
}

// ---- Extract headings for TOC ----
export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function extractHeadings(html: string): TocHeading[] {
  if (typeof window === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings: TocHeading[] = [];

  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const text = el.textContent?.trim() || '';
    const level = parseInt(el.tagName[1]);
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ id, text, level });
  });

  return headings;
}

// ---- Search ----
export interface SearchResult {
  fileId: string;
  filename: string;
  line: string;
  lineNumber: number;
}

export function searchFiles(
  files: { id: string; filename: string; content: string }[],
  query: string
): SearchResult[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(lower)) {
        results.push({
          fileId: file.id,
          filename: file.filename,
          line: lines[i].trim(),
          lineNumber: i + 1,
        });
      }
    }
  }

  return results.slice(0, 50);
}
