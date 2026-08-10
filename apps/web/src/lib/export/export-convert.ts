import { triggerDownload } from './export-utils';

/**
 * Convert markdown to reStructuredText (RST) format.
 * Handles headings, bold, italic, code, links, lists, images, and tables.
 */
export function markdownToRst(md: string): string {
  let rst = md;

  // Remove frontmatter
  rst = rst.replace(/^---\n[\s\S]*?\n---\n?/, '');

  // ── Extract code first (same scheme as the AsciiDoc converter) so the
  // prose-level regexes below can never mangle code contents — otherwise
  // a `# comment` in a bash fence grows a heading underline, and links or
  // backticks inside code get rewritten.
  const codeBlocks: string[] = [];
  rst = rst.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const directive = lang ? `.. code-block:: ${lang}` : '.. code-block::';
    const indented = (code as string).replace(/\n$/, '').split('\n').map((line) => `   ${line}`).join('\n');
    codeBlocks.push(`${directive}\n\n${indented}`);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });
  const inlineCode: string[] = [];
  rst = rst.replace(/(?<!`)`([^`\n]+)`(?!`)/g, (_, code) => {
    inlineCode.push(`\`\`${code}\`\``);
    return `%%INLINECODE_${inlineCode.length - 1}%%`;
  });

  // Images MUST be processed before links (both use [text](url) pattern)
  // Images: ![alt](url) → .. image:: url\n   :alt: alt
  rst = rst.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '.. image:: $2\n   :alt: $1');

  // Links: [text](url) → `text <url>`_
  rst = rst.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '`$1 <$2>`_');

  // Restore inline code before measuring heading underlines so lengths
  // are computed on the final text.
  inlineCode.forEach((code, i) => {
    rst = rst.replace(`%%INLINECODE_${i}%%`, () => code);
  });

  // Horizontal rules BEFORE headings — running this after would truncate
  // the all-dash underlines the heading pass just emitted, producing
  // "title underline too short" RST.
  rst = rst.replace(/^(-{3,}|_{3,}|\*{3,})$/gm, '----');

  // Headings — RST uses underlines with specific characters
  const rstChars: Record<number, string> = { 1: '=', 2: '-', 3: '~', 4: '^', 5: '"', 6: '.' };
  rst = rst.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const level = hashes.length;
    const char = rstChars[level] || '.';
    const underline = char.repeat(Math.max(text.length, 4));
    return level === 1 ? `${underline}\n${text}\n${underline}` : `${text}\n${underline}`;
  });

  // Unordered lists: - item → * item
  rst = rst.replace(/^(\s*)[-+]\s+/gm, '$1* ');

  // Ordered lists: 1. item → #. item
  rst = rst.replace(/^(\s*)\d+\.\s+/gm, '$1#. ');

  // Blockquotes — indent with spaces (RST uses indentation)
  rst = rst.replace(/^>\s?(.*)/gm, '   $1');

  // Task lists: - [x] item → * |check| item, - [ ] item → * |uncheck| item
  rst = rst.replace(/^\* \[x\]/gm, '* ☑');
  rst = rst.replace(/^\* \[ \]/gm, '* ☐');

  // ── Restore code blocks last, untouched by everything above.
  codeBlocks.forEach((block, i) => {
    rst = rst.replace(`%%CODEBLOCK_${i}%%`, () => block);
  });

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

  // Protect inline code from the image/link/bold rewrites (syntax is the
  // same in AsciiDoc, so contents round-trip unchanged).
  const inlineCode: string[] = [];
  adoc = adoc.replace(/(?<!`)`([^`\n]+)`(?!`)/g, (m) => {
    inlineCode.push(m);
    return `%%INLINECODE_${inlineCode.length - 1}%%`;
  });

  // Images MUST be processed before links (both use [text](url) pattern)
  // Images: ![alt](url) → image::url[alt]
  adoc = adoc.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 'image::$2[$1]');

  // Bold: **text** → *text*
  adoc = adoc.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // Links: [text](url) → url[text]
  adoc = adoc.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$2[$1]');

  inlineCode.forEach((code, i) => {
    adoc = adoc.replace(`%%INLINECODE_${i}%%`, () => code);
  });

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

  // ── Restore code blocks (function replacer — code may contain `$&`) ──
  codeBlocks.forEach((block, i) => {
    adoc = adoc.replace(`%%CODEBLOCK_${i}%%`, () => block);
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

