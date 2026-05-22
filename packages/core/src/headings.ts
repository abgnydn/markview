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

/**
 * Strip HTML tags from a string iteratively (no backtracking risk).
 * Handles unclosed tags and nested tags safely.
 */
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

export function extractHeadings(html: string): TocHeading[] {
  const headings: TocHeading[] = [];

  // Use iterative search instead of a single complex regex to avoid polynomial backtracking.
  // We search for `<h` then parse the tag manually.
  let pos = 0;
  while (pos < html.length) {
    const tagStart = html.indexOf('<h', pos);
    if (tagStart === -1) break;

    // Check for h1-h6
    const levelChar = html[tagStart + 2];
    if (levelChar < '1' || levelChar > '6') {
      pos = tagStart + 2;
      continue;
    }
    const level = parseInt(levelChar);

    // Next char must be '>' or whitespace (not another letter like <header>)
    const afterLevel = html[tagStart + 3];
    if (afterLevel !== '>' && afterLevel !== ' ' && afterLevel !== '\t' && afterLevel !== '\n') {
      pos = tagStart + 2;
      continue;
    }

    // Find the end of the opening tag
    const openTagEnd = html.indexOf('>', tagStart + 3);
    if (openTagEnd === -1) break;

    // Extract id attribute if present
    const tagAttrs = html.slice(tagStart + 3, openTagEnd);
    const idMatch = tagAttrs.match(/\bid="([^"]*)"/);
    const existingId = idMatch?.[1];

    // Find closing tag </hN>
    const closeTag = `</h${levelChar}>`;
    const closeIdx = html.indexOf(closeTag, openTagEnd + 1);
    if (closeIdx === -1) {
      pos = openTagEnd + 1;
      continue;
    }

    // Extract inner HTML and strip tags iteratively
    const inner = html.slice(openTagEnd + 1, closeIdx);
    const text = stripHtmlTags(inner).trim();

    if (text) {
      const id = existingId || text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      headings.push({ id, text, level });
    }

    pos = closeIdx + closeTag.length;
  }

  return headings;
}
