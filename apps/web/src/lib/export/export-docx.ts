import { renderMarkdown } from '@/lib/markdown/pipeline';

/**
 * Export the active markdown as a DOCX Word document.
 * Uses the 'docx' library to programmatically build a Word document.
 */
export async function downloadAsDocx(
  filename: string,
  content: string
): Promise<void> {
  const {
    Document, Paragraph, TextRun, HeadingLevel, Packer,
    Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
    ExternalHyperlink
  } = await import('docx');

  const html = await renderMarkdown(content);
  const title = filename.replace(/\.md$/i, '');

  // Parse HTML into a temporary DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];

  function parseInlineContent(el: Element): InstanceType<typeof TextRun | typeof ExternalHyperlink>[] {
    const runs: InstanceType<typeof TextRun | typeof ExternalHyperlink>[] = [];
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const txt = node.textContent || '';
        if (txt.trim()) runs.push(new TextRun(txt));
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

    // Lists
    if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll(':scope > li').forEach((li, idx) => {
        const prefix = tag === 'ol' ? `${idx + 1}. ` : '• ';
        const runs = parseInlineContent(li);
        runs.unshift(new TextRun(prefix));
        children.push(new Paragraph({ children: runs, indent: { left: 720 } }));
      });
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

  const wordDoc = new Document({
    title,
    creator: 'MarkView',
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(wordDoc);
  triggerDownload(blob, `${title}.docx`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
