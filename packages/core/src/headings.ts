/**
 * Extract headings from rendered HTML for table of contents.
 * Works isomorphically — uses regex-based extraction (no DOMParser needed).
 *
 * @example
 * ```ts
 * import { renderMarkdown, extractHeadings } from '@markview/core';
 *
 * const html = await renderMarkdown('# Title\n## Section\n### Subsection');
 * const headings = extractHeadings(html);
 * // [
 * //   { id: 'title', text: 'Title', level: 1 },
 * //   { id: 'section', text: 'Section', level: 2 },
 * //   { id: 'subsection', text: 'Subsection', level: 3 },
 * // ]
 * ```
 */

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

export function extractHeadings(html: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const regex = /<h([1-6])(?:\s+id="([^"]*)")?[^>]*>(.*?)<\/h\1>/g;

  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const existingId = match[2];
    // Strip HTML tags to get plain text
    const text = match[3].replace(/<[^>]*>/g, '').trim();
    const id = existingId || text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    headings.push({ id, text, level });
  }

  return headings;
}
