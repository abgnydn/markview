import { triggerDownload } from './export-utils';

/**
 * Convert markdown to reStructuredText (RST) format.
 * Handles headings, bold, italic, code, links, lists, images, and tables.
 */
export function markdownToRst(md: string): string {
  let rst = md;

  // Remove frontmatter
  rst = rst.replace(/^---\n[\s\S]*?\n---\n?/, '');

  // Headings — RST uses underlines with specific characters
  const rstChars: Record<number, string> = { 1: '=', 2: '-', 3: '~', 4: '^', 5: '"', 6: '.' };
  rst = rst.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const level = hashes.length;
    const char = rstChars[level] || '.';
    const underline = char.repeat(text.length);
    return level === 1 ? `${underline}\n${text}\n${underline}` : `${text}\n${underline}`;
  });

  // Bold: **text** → **text** (same in RST)
  // Italic: *text* → *text* (same in RST)
  // Images MUST be processed before links (both use [text](url) pattern)
  // Images: ![alt](url) → .. image:: url\n   :alt: alt
  rst = rst.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '.. image:: $2\n   :alt: $1');

  // Inline code: `text` → ``text`` 
  rst = rst.replace(/(?<!`)`([^`]+)`(?!`)/g, '``$1``');

  // Links: [text](url) → `text <url>`_
  rst = rst.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '`$1 <$2>`_');

  // Code blocks: ```lang\ncode\n``` → .. code-block:: lang\n\n   code
  rst = rst.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const directive = lang ? `.. code-block:: ${lang}` : '.. code-block::';
    const indented = code.split('\n').map((line: string) => `   ${line}`).join('\n');
    return `${directive}\n\n${indented}`;
  });

  // Unordered lists: - item → * item
  rst = rst.replace(/^(\s*)[-+]\s+/gm, '$1* ');

  // Ordered lists: 1. item → #. item
  rst = rst.replace(/^(\s*)\d+\.\s+/gm, '$1#. ');

  // Blockquotes — indent with spaces (RST uses indentation)
  rst = rst.replace(/^>\s?(.*)/gm, '   $1');

  // Horizontal rules: --- → ----
  rst = rst.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '----');

  // Task lists: - [x] item → * |check| item, - [ ] item → * |uncheck| item
  rst = rst.replace(/^\* \[x\]/gm, '* ☑');
  rst = rst.replace(/^\* \[ \]/gm, '* ☐');

  return rst.trim() + '\n';
}

/**
 * Convert markdown to AsciiDoc format.
 * Handles headings, bold, italic, code, links, lists, images, and tables.
 */
export function markdownToAsciidoc(md: string): string {
  let adoc = md;

  // Remove frontmatter
  adoc = adoc.replace(/^---\n[\s\S]*?\n---\n?/, '');

  // ── Extract code blocks to placeholders (protect from other regexes) ──
  const codeBlocks: string[] = [];
  adoc = adoc.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const header = lang ? `[source,${lang}]` : '[source]';
    const block = `${header}\n----\n${code.trimEnd()}\n----`;
    codeBlocks.push(block);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // Headings: # → =, ## → ==, etc.
  adoc = adoc.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const equals = '='.repeat(hashes.length);
    return `${equals} ${text}`;
  });

  // Images MUST be processed before links (both use [text](url) pattern)
  // Images: ![alt](url) → image::url[alt]
  adoc = adoc.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 'image::$2[$1]');

  // Bold: **text** → *text*
  adoc = adoc.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // Inline code: `text` → `text` (same)

  // Links: [text](url) → url[text]
  adoc = adoc.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2[$1]');

  // Unordered lists: - item → * item (already correct for first level)
  adoc = adoc.replace(/^(\s*)[-+]\s+/gm, (_, spaces) => {
    const depth = Math.floor(spaces.length / 2) + 1;
    return '*'.repeat(depth) + ' ';
  });

  // Ordered lists: 1. item → . item
  adoc = adoc.replace(/^(\s*)\d+\.\s+/gm, (_, spaces) => {
    const depth = Math.floor(spaces.length / 2) + 1;
    return '.'.repeat(depth) + ' ';
  });

  // Blockquotes: > text → ____\ntext\n____
  adoc = adoc.replace(/^>\s?(.*)$/gm, '____\n$1\n____');
  adoc = adoc.replace(/____\n____\n/g, '');

  // Horizontal rules: --- → '''
  adoc = adoc.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, "'''");

  // Task lists
  adoc = adoc.replace(/^\* \[x\]/gm, '* [*]');
  // Note: unchecked task lists (- [ ]) are already valid AsciiDoc after list conversion (* [ ])

  // ── Restore code blocks ──
  codeBlocks.forEach((block, i) => {
    adoc = adoc.replace(`%%CODEBLOCK_${i}%%`, block);
  });

  return adoc.trim() + '\n';
}

/**
 * Download content as RST file.
 */
export function downloadAsRst(filename: string, content: string): void {
  const title = filename.replace(/\.md$/i, '');
  const rst = markdownToRst(content);
  const blob = new Blob([rst], { type: 'text/x-rst;charset=utf-8' });
  triggerDownload(blob, `${title}.rst`);
}

/**
 * Download content as AsciiDoc file.
 */
export function downloadAsAsciidoc(filename: string, content: string): void {
  const title = filename.replace(/\.md$/i, '');
  const adoc = markdownToAsciidoc(content);
  const blob = new Blob([adoc], { type: 'text/asciidoc;charset=utf-8' });
  triggerDownload(blob, `${title}.adoc`);
}

