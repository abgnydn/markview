import { renderMarkdown } from '@/lib/markdown/pipeline';
import { expandWikilinks } from '@/lib/markdown/wikilinks';
import { triggerDownload, inlineAssetImages } from './export-utils';

/**
 * Export the active markdown as a DOCX Word document.
 * Uses the 'docx' library to programmatically build a Word document.
 */
export async function downloadAsDocx(
  filename: string,
  content: string
): Promise<void> {
  const title = filename.replace(/\.md$/i, '');
  const { Packer } = await import('docx');
  const wordDoc = await buildDocxDocument(content, title);
  const blob = await Packer.toBlob(wordDoc);
  triggerDownload(blob, `${title}.docx`);
}

/**
 * Build the docx `Document` from markdown content. Split out from the
 * download so the structure can be asserted in tests (the download side
 * effects can't run under jsdom).
 */
export async function buildDocxDocument(content: string, title: string) {
  const {
    Document, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
    ExternalHyperlink, ImageRun
  } = await import('docx');

  // Wikilinks expanded + asset: images inlined as data URIs so the img
  // branch below can embed them (math intentionally stays literal LaTeX).
  const html = await inlineAssetImages(
    await renderMarkdown(expandWikilinks(content), { codeBlockToolbar: false }),
  );

  // Parse HTML into a temporary DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Pre-measure data-URI images (async) so the synchronous walker below
  // can emit correctly-proportioned ImageRuns.
  const imgDims = new Map<string, { width: number; height: number }>();
  for (const img of Array.from(doc.querySelectorAll('img[src^="data:image/"]'))) {
    const src = img.getAttribute('src') || '';
    if (!src || imgDims.has(src)) continue;
    const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
      probe.onerror = () => resolve(null);
      probe.src = src;
    });
    if (dims && dims.width > 0) imgDims.set(src, dims);
  }

  const DOCX_MAX_IMG_WIDTH = 560; // pt-ish px inside the printable area
  function imageRunFromDataUri(src: string): InstanceType<typeof ImageRun> | null {
    const m = /^data:image\/(png|jpeg|jpg|gif|bmp);base64,(.+)$/.exec(src);
    if (!m) return null; // svg/webp and friends fall back to alt text
    const dims = imgDims.get(src);
    if (!dims) return null;
    const scale = Math.min(1, DOCX_MAX_IMG_WIDTH / dims.width);
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const type = m[1] === 'jpeg' ? 'jpg' : m[1];
    return new ImageRun({
      data: bytes,
      type: type as 'png' | 'jpg' | 'gif' | 'bmp',
      transformation: { width: Math.round(dims.width * scale), height: Math.round(dims.height * scale) },
    });
  }

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  function parseInlineContent(el: Element): InstanceType<typeof TextRun | typeof ExternalHyperlink>[] {
    const runs: InstanceType<typeof TextRun | typeof ExternalHyperlink>[] = [];
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent || '';
        if (txt.trim()) runs.push(new TextRun(txt));
        // Whitespace-only nodes between inline elements still separate
        // words — dropping them renders "**a** *b*" as "ab".
        else if (txt.length > 0 && runs.length > 0) runs.push(new TextRun(' '));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const child = node as Element;
        const tag = child.tagName.toLowerCase();
        const text = child.textContent || '';
        if (tag === 'strong' || tag === 'b') {
          runs.push(new TextRun({ text, bold: true }));
        } else if (tag === 'em' || tag === 'i') {
          runs.push(new TextRun({ text, italics: true }));
        } else if (tag === 'code') {
          runs.push(new TextRun({ text, font: 'Courier New', size: 20, shading: { fill: 'f0f0f0' } }));
        } else if (tag === 'a') {
          const href = child.getAttribute('href') || '';
          runs.push(new ExternalHyperlink({ children: [new TextRun({ text, style: 'Hyperlink' })], link: href }));
        } else if (tag === 'del' || tag === 's') {
          runs.push(new TextRun({ text, strike: true }));
        } else if (tag === 'img') {
          const imgRun = imageRunFromDataUri(child.getAttribute('src') || '');
          if (imgRun) runs.push(imgRun as unknown as InstanceType<typeof TextRun>);
          else if (child.getAttribute('alt')) {
            runs.push(new TextRun({ text: `[image: ${child.getAttribute('alt')}]`, italics: true }));
          }
        } else if (tag === 'ul' || tag === 'ol') {
          // Nested lists are emitted by processList recursion, not inline.
        } else if (tag === 'p' || tag === 'span' || tag === 'div') {
          runs.push(...parseInlineContent(child));
        } else {
          runs.push(new TextRun(text));
        }
      }
    });
    return runs;
  }

  const headingMap: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
    h4: HeadingLevel.HEADING_4,
    h5: HeadingLevel.HEADING_5,
    h6: HeadingLevel.HEADING_6,
  };

  // Emit a list and any nested sub-lists, each level indented one step
  // deeper. Ordered lists number per level; the li's own inline content is
  // taken minus its nested lists (those recurse).
  function processList(listEl: Element, level: number) {
    const ordered = listEl.tagName.toLowerCase() === 'ol';
    let idx = 0;
    listEl.querySelectorAll(':scope > li').forEach((li) => {
      idx++;
      const prefix = ordered ? `${idx}. ` : '• ';
      const clone = li.cloneNode(true) as Element;
      clone.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => n.remove());
      const runs = parseInlineContent(clone);
      runs.unshift(new TextRun(prefix));
      children.push(new Paragraph({ children: runs, indent: { left: 720 * (level + 1) } }));
      li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => processList(sub, level + 1));
    });
  }

  function processNode(el: Element) {
    const tag = el.tagName.toLowerCase();

    // Headings
    if (headingMap[tag]) {
      children.push(new Paragraph({ heading: headingMap[tag], children: parseInlineContent(el) }));
      return;
    }

    // Paragraphs
    if (tag === 'p') {
      children.push(new Paragraph({ children: parseInlineContent(el) }));
      return;
    }

    // Lists (recursive — nested ul/ol get a deeper indent instead of being
    // flattened into the parent line).
    if (tag === 'ul' || tag === 'ol') {
      processList(el, 0);
      return;
    }

    // Code blocks
    if (tag === 'pre') {
      const code = el.querySelector('code')?.textContent || el.textContent || '';
      code.split('\n').forEach((line) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 18 })],
          shading: { fill: 'f6f8fa' },
          spacing: { before: 0, after: 0 },
        }));
      });
      children.push(new Paragraph({ children: [] })); // spacer
      return;
    }

    // Blockquotes
    if (tag === 'blockquote') {
      const text = el.textContent || '';
      children.push(new Paragraph({
        children: [new TextRun({ text, italics: true, color: '656d76' })],
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: 'd0d7de' } },
      }));
      return;
    }

    // Tables
    if (tag === 'table') {
      const rows: InstanceType<typeof TableRow>[] = [];
      el.querySelectorAll('tr').forEach((tr) => {
        const cells: InstanceType<typeof TableCell>[] = [];
        tr.querySelectorAll('th, td').forEach((cell) => {
          const isHeader = cell.tagName.toLowerCase() === 'th';
          cells.push(new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: cell.textContent || '', bold: isHeader, size: 20 })],
              alignment: AlignmentType.LEFT,
            })],
            width: { size: 100 / (tr.children.length || 1), type: WidthType.PERCENTAGE },
            shading: isHeader ? { fill: 'f6f8fa' } : undefined,
          }));
        });
        if (cells.length > 0) rows.push(new TableRow({ children: cells }));
      });
      if (rows.length > 0) {
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        children.push(new Paragraph({ children: [] })); // spacer
      }
      return;
    }

    // HR
    if (tag === 'hr') {
      children.push(new Paragraph({
        children: [],
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'd0d7de' } },
        spacing: { before: 200, after: 200 },
      }));
      return;
    }

    // Recurse for divs/sections/etc
    if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
      Array.from(el.children).forEach(processNode);
    }
  }

  Array.from(doc.body.children).forEach(processNode);

  // At minimum add an empty paragraph if no children
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun(content)] }));
  }

  return new Document({
    title,
    creator: 'MarkView',
    sections: [{ children }],
  });
}

