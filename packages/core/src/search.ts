/**
 * Full-text search across markdown files.
 *
 * @example
 * ```ts
 * import { searchFiles } from '@markview/core';
 *
 * const results = searchFiles([
 *   { id: '1', filename: 'README.md', content: '# Hello\nWorld' },
 *   { id: '2', filename: 'GUIDE.md', content: '# Guide\nHello there' },
 * ], 'hello');
 * // Returns matches with file, line number, and line content
 * ```
 */

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
