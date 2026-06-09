// SPDX-License-Identifier: Apache-2.0

/**
 * Smart-paste helpers — turn pasted spreadsheet data into a GitHub-flavored
 * markdown table. Excel / Google Sheets put tab-separated text on the
 * clipboard (text/plain); web-page tables come as text/html. Both routes
 * funnel into rowsToMarkdownTable.
 */

function rowsToMarkdownTable(rows: string[][]): string | null {
  const clean = rows.filter((r) => r.length > 0);
  if (clean.length < 1) return null;
  const cols = Math.max(...clean.map((r) => r.length));
  if (cols < 2) return null; // a single column isn't worth a table
  const esc = (c: string) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
  const pad = (r: string[]) => {
    const out = r.map(esc);
    while (out.length < cols) out.push('');
    return out;
  };
  const header = pad(clean[0]);
  const sep = header.map(() => '---');
  const body = clean.slice(1).map(pad);
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(sep), ...body.map(line)].join('\n');
}

/** Tab-separated text (Excel / Sheets) → markdown table, or null. */
export function tsvToMarkdownTable(text: string): string | null {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  if (!normalized.includes('\t')) return null;
  const rows = normalized.split('\n').map((r) => r.split('\t'));
  return rowsToMarkdownTable(rows);
}

/** An HTML clipboard fragment containing a <table> → markdown table, or null. */
export function htmlTableToMarkdown(html: string): string | null {
  if (typeof DOMParser === 'undefined' || !/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).map((cell) =>
      (cell.textContent || '').replace(/\s+/g, ' ').trim(),
    ),
  );
  return rowsToMarkdownTable(rows);
}

/** Pick the best markdown table from whatever the clipboard offered. */
export function clipboardToTable(text: string, html: string): string | null {
  return tsvToMarkdownTable(text) ?? htmlTableToMarkdown(html);
}
