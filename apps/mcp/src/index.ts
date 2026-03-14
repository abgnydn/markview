#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively find all .md files in a directory */
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      results.push(...findMarkdownFiles(full));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
      results.push(full);
    }
  }
  return results;
}

/** Extract headings from markdown content */
function extractHeadings(content: string): Array<{ level: number; text: string; line: number }> {
  const headings: Array<{ level: number; text: string; line: number }> = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/[#*`\[\]]/g, '').trim(),
        line: i + 1,
      });
    }
  }
  return headings;
}

/** Extract links from markdown content */
function extractLinks(content: string): Array<{ text: string; href: string; line: number; isInternal: boolean }> {
  const links: Array<{ text: string; href: string; line: number; isInternal: boolean }> = [];
  const lines = content.split('\n');
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  for (let i = 0; i < lines.length; i++) {
    let match;
    while ((match = linkRegex.exec(lines[i])) !== null) {
      const href = match[2];
      const isInternal = !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#');
      links.push({
        text: match[1],
        href,
        line: i + 1,
        isInternal,
      });
    }
  }
  return links;
}

/** Calculate word count and reading time */
function getStats(content: string) {
  const text = content.replace(/[#*`\[\]()>-]/g, '').trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 230));
  return { words, readingTimeMinutes: minutes, lines: content.split('\n').length };
}

/** Extract code blocks from markdown */
function extractCodeBlocks(content: string): Array<{ language: string; code: string; line: number }> {
  const blocks: Array<{ language: string; code: string; line: number }> = [];
  const lines = content.split('\n');
  let inBlock = false;
  let lang = '';
  let code: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!inBlock && lines[i].match(/^```(\w*)/)) {
      inBlock = true;
      lang = lines[i].match(/^```(\w*)/)![1] || 'text';
      code = [];
      startLine = i + 1;
    } else if (inBlock && lines[i].trimEnd() === '```') {
      blocks.push({ language: lang, code: code.join('\n'), line: startLine });
      inBlock = false;
    } else if (inBlock) {
      code.push(lines[i]);
    }
  }
  return blocks;
}

/** Parse YAML frontmatter */
function parseFrontmatter(content: string): { data: Record<string, string>; content: string } | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return null;
  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) return null;

  const yamlBlock = trimmed.slice(4, endIdx).trim();
  const body = trimmed.slice(endIdx + 4).trimStart();
  const data: Record<string, string> = {};

  for (const line of yamlBlock.split('\n')) {
    const match = line.match(/^(\w[\w\s-]*?):\s*(.+)$/);
    if (match) data[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return { data, content: body };
}

/** Extract tables from markdown as structured data */
function extractTables(content: string): Array<{ headers: string[]; rows: string[][]; line: number }> {
  const tables: Array<{ headers: string[]; rows: string[][]; line: number }> = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    // Look for header row (contains |)
    if (lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?\s*[-:]+/)) {
      const parseRow = (line: string) =>
        line.split('|').map((c) => c.trim()).filter((c) => c.length > 0);

      const headers = parseRow(lines[i]);
      const rows: string[][] = [];
      let j = i + 2; // skip separator
      while (j < lines.length && lines[j].includes('|')) {
        rows.push(parseRow(lines[j]));
        j++;
      }
      tables.push({ headers, rows, line: i + 1 });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const docsDir = process.argv[2] || '.';
const resolvedDir = path.resolve(docsDir);

if (!fs.existsSync(resolvedDir)) {
  console.error(`Error: Directory not found: ${resolvedDir}`);
  process.exit(1);
}

/**
 * Security: Validate that a resolved file path stays within the workspace.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 */
function safePath(filePath: string): string {
  const full = path.resolve(resolvedDir, filePath);
  if (!full.startsWith(resolvedDir + path.sep) && full !== resolvedDir) {
    throw new Error(`Path traversal blocked: "${filePath}" resolves outside workspace`);
  }
  return full;
}

const server = new McpServer({
  name: 'markview-mcp',
  version: '1.0.0',
});

// ---------------------------------------------------------------------------
// Tool: list_documents
// ---------------------------------------------------------------------------
server.tool(
  'list_documents',
  'List all markdown documents in the workspace with metadata (word count, headings count, last modified)',
  {
    pattern: z.string().optional().describe('Optional glob pattern to filter files, e.g. "api" to match files containing "api"'),
  },
  async ({ pattern }) => {
    const files = findMarkdownFiles(resolvedDir);
    const results = files
      .map((f) => {
        const relative = path.relative(resolvedDir, f);
        const content = fs.readFileSync(f, 'utf-8');
        const stats = getStats(content);
        const fileStat = fs.statSync(f);
        return {
          path: relative,
          ...stats,
          headings: extractHeadings(content).length,
          lastModified: fileStat.mtime.toISOString(),
        };
      })
      .filter((f) => !pattern || f.path.toLowerCase().includes(pattern.toLowerCase()));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              directory: resolvedDir,
              totalFiles: results.length,
              documents: results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_document
// ---------------------------------------------------------------------------
server.tool(
  'get_document',
  'Read the full content of a specific markdown document',
  {
    path: z.string().describe('Relative path to the document, e.g. "api/auth.md" or "README.md"'),
    includeMetadata: z.boolean().optional().describe('Include word count, headings, and links metadata'),
  },
  async ({ path: filePath, includeMetadata }) => {
    const fullPath = path.resolve(resolvedDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return {
        content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }],
        isError: true,
      };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const parts: Array<{ type: 'text'; text: string }> = [
      { type: 'text' as const, text: content },
    ];

    if (includeMetadata) {
      const metadata = {
        stats: getStats(content),
        headings: extractHeadings(content),
        links: extractLinks(content),
      };
      parts.push({
        type: 'text' as const,
        text: '\n---\nMetadata:\n' + JSON.stringify(metadata, null, 2),
      });
    }

    return { content: parts };
  }
);

// ---------------------------------------------------------------------------
// Tool: search_docs
// ---------------------------------------------------------------------------
server.tool(
  'search_docs',
  'Full-text search across all markdown documents in the workspace. Returns matching lines with context.',
  {
    query: z.string().describe('Search query — case-insensitive text search'),
    maxResults: z.number().optional().describe('Maximum results to return (default: 20)'),
    contextLines: z.number().optional().describe('Number of context lines around each match (default: 1)'),
  },
  async ({ query, maxResults = 20, contextLines = 1 }) => {
    const files = findMarkdownFiles(resolvedDir);
    const lowerQuery = query.toLowerCase();
    const results: Array<{
      file: string;
      line: number;
      match: string;
      context: string[];
    }> = [];

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lowerQuery)) {
          const start = Math.max(0, i - contextLines);
          const end = Math.min(lines.length - 1, i + contextLines);
          results.push({
            file: path.relative(resolvedDir, f),
            line: i + 1,
            match: lines[i].trim(),
            context: lines.slice(start, end + 1),
          });
          if (results.length >= maxResults) break;
        }
      }
      if (results.length >= maxResults) break;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              query,
              totalMatches: results.length,
              results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_headings
// ---------------------------------------------------------------------------
server.tool(
  'get_headings',
  'Get the heading structure (table of contents) for a document or the entire workspace',
  {
    path: z.string().optional().describe('Relative path to a specific document. If omitted, returns headings for all documents.'),
  },
  async ({ path: filePath }) => {
    if (filePath) {
      const fullPath = path.resolve(resolvedDir, filePath);
      if (!fs.existsSync(fullPath)) {
        return {
          content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }],
          isError: true,
        };
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ file: filePath, headings: extractHeadings(content) }, null, 2),
          },
        ],
      };
    }

    const files = findMarkdownFiles(resolvedDir);
    const allHeadings = files.map((f) => ({
      file: path.relative(resolvedDir, f),
      headings: extractHeadings(fs.readFileSync(f, 'utf-8')),
    }));

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(allHeadings, null, 2) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_links
// ---------------------------------------------------------------------------
server.tool(
  'get_links',
  'Extract all links from a document or workspace. Identifies internal (.md) vs external links and validates internal link targets.',
  {
    path: z.string().optional().describe('Relative path to a specific document. If omitted, analyzes all documents.'),
    internalOnly: z.boolean().optional().describe('If true, only return internal (.md) links'),
  },
  async ({ path: filePath, internalOnly }) => {
    const allFiles = findMarkdownFiles(resolvedDir);
    const allRelative = new Set(allFiles.map((f) => path.relative(resolvedDir, f)));

    const processFile = (fPath: string) => {
      const content = fs.readFileSync(fPath, 'utf-8');
      let links = extractLinks(content);
      if (internalOnly) links = links.filter((l) => l.isInternal);

      const relative = path.relative(resolvedDir, fPath);
      return {
        file: relative,
        links: links.map((l) => {
          if (l.isInternal) {
            const resolved = path.normalize(path.join(path.dirname(relative), l.href));
            return { ...l, resolvedPath: resolved, exists: allRelative.has(resolved) };
          }
          return l;
        }),
      };
    };

    if (filePath) {
      const fullPath = path.resolve(resolvedDir, filePath);
      if (!fs.existsSync(fullPath)) {
        return {
          content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(processFile(fullPath), null, 2) }],
      };
    }

    const results = allFiles.map(processFile);
    const brokenLinks = results.flatMap((r) =>
      r.links.filter((l: any) => l.isInternal && l.exists === false).map((l: any) => ({
        from: r.file,
        ...l,
      }))
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              totalFiles: results.length,
              totalLinks: results.reduce((a, r) => a + r.links.length, 0),
              brokenLinks,
              files: results,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_code_blocks
// ---------------------------------------------------------------------------
server.tool(
  'get_code_blocks',
  'Extract all code blocks from a document with their language identifiers. Useful for analyzing code examples in documentation.',
  {
    path: z.string().describe('Relative path to the document'),
    language: z.string().optional().describe('Filter by language, e.g. "typescript", "python"'),
  },
  async ({ path: filePath, language }) => {
    const fullPath = path.resolve(resolvedDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    let blocks = extractCodeBlocks(content);
    if (language) blocks = blocks.filter((b) => b.language.toLowerCase() === language.toLowerCase());

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          file: filePath,
          totalBlocks: blocks.length,
          languages: [...new Set(blocks.map((b) => b.language))],
          blocks,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_frontmatter
// ---------------------------------------------------------------------------
server.tool(
  'get_frontmatter',
  'Extract YAML frontmatter metadata from a document or all documents. Returns key-value pairs like title, author, date, tags.',
  {
    path: z.string().optional().describe('Relative path to a specific document. If omitted, extracts frontmatter from all documents.'),
  },
  async ({ path: filePath }) => {
    if (filePath) {
      const fullPath = path.resolve(resolvedDir, filePath);
      if (!fs.existsSync(fullPath)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      const fm = parseFrontmatter(content);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ file: filePath, hasFrontmatter: !!fm, frontmatter: fm?.data || {} }, null, 2),
        }],
      };
    }

    const files = findMarkdownFiles(resolvedDir);
    const results = files.map((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      const fm = parseFrontmatter(content);
      return {
        file: path.relative(resolvedDir, f),
        hasFrontmatter: !!fm,
        frontmatter: fm?.data || {},
      };
    }).filter((r) => r.hasFrontmatter);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ totalWithFrontmatter: results.length, documents: results }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_tables
// ---------------------------------------------------------------------------
server.tool(
  'get_tables',
  'Extract all tables from a markdown document as structured JSON with headers and rows.',
  {
    path: z.string().describe('Relative path to the document'),
  },
  async ({ path: filePath }) => {
    const fullPath = path.resolve(resolvedDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const tables = extractTables(content);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ file: filePath, totalTables: tables.length, tables }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: validate_workspace
// ---------------------------------------------------------------------------
server.tool(
  'validate_workspace',
  'Run a comprehensive health check on the documentation workspace: broken links, orphan files (not linked to), missing titles, empty documents, and duplicate headings.',
  {},
  async () => {
    const allFiles = findMarkdownFiles(resolvedDir);
    const allRelative = new Set(allFiles.map((f) => path.relative(resolvedDir, f)));

    const issues: Array<{ type: string; severity: 'error' | 'warning' | 'info'; file: string; message: string }> = [];
    const linkedTo = new Set<string>();

    for (const f of allFiles) {
      const relative = path.relative(resolvedDir, f);
      const content = fs.readFileSync(f, 'utf-8');
      const headings = extractHeadings(content);
      const links = extractLinks(content);
      const stats = getStats(content);

      // Check: empty or near-empty document
      if (stats.words < 5) {
        issues.push({ type: 'empty_doc', severity: 'warning', file: relative, message: `Document has only ${stats.words} words` });
      }

      // Check: missing H1 title
      if (!headings.some((h) => h.level === 1)) {
        issues.push({ type: 'missing_title', severity: 'warning', file: relative, message: 'No H1 heading found' });
      }

      // Check: broken internal links
      for (const link of links) {
        if (link.isInternal) {
          const resolved = path.normalize(path.join(path.dirname(relative), link.href));
          linkedTo.add(resolved);
          if (!allRelative.has(resolved)) {
            issues.push({
              type: 'broken_link',
              severity: 'error',
              file: relative,
              message: `Broken link to "${link.href}" (resolved: ${resolved}) at line ${link.line}`,
            });
          }
        }
      }

      // Check: duplicate H1 headings
      const h1s = headings.filter((h) => h.level === 1);
      if (h1s.length > 1) {
        issues.push({ type: 'duplicate_h1', severity: 'info', file: relative, message: `Multiple H1 headings (${h1s.length})` });
      }
    }

    // Check: orphan files (not linked from any other doc)
    for (const f of allFiles) {
      const relative = path.relative(resolvedDir, f);
      if (!linkedTo.has(relative) && allFiles.length > 1) {
        issues.push({ type: 'orphan', severity: 'info', file: relative, message: 'Not linked from any other document' });
      }
    }

    const byType = issues.reduce((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          totalFiles: allFiles.length,
          totalIssues: issues.length,
          errors: issues.filter((i) => i.severity === 'error').length,
          warnings: issues.filter((i) => i.severity === 'warning').length,
          issuesByType: byType,
          issues,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_stats
// ---------------------------------------------------------------------------
server.tool(
  'get_stats',
  'Get comprehensive workspace-wide statistics: total files, words, reading time, code languages, link graph density.',
  {},
  async () => {
    const files = findMarkdownFiles(resolvedDir);
    let totalWords = 0;
    let totalLines = 0;
    const allLanguages = new Set<string>();
    let totalLinks = 0;
    let totalInternalLinks = 0;
    let totalCodeBlocks = 0;
    let totalTables = 0;
    let totalHeadings = 0;
    let filesWithFrontmatter = 0;

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      const stats = getStats(content);
      totalWords += stats.words;
      totalLines += stats.lines;

      const blocks = extractCodeBlocks(content);
      totalCodeBlocks += blocks.length;
      blocks.forEach((b) => allLanguages.add(b.language));

      const links = extractLinks(content);
      totalLinks += links.length;
      totalInternalLinks += links.filter((l) => l.isInternal).length;

      totalTables += extractTables(content).length;
      totalHeadings += extractHeadings(content).length;
      if (parseFrontmatter(content)) filesWithFrontmatter++;
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          totalFiles: files.length,
          totalWords,
          totalLines,
          totalReadingTimeMinutes: Math.max(1, Math.ceil(totalWords / 230)),
          totalHeadings,
          totalCodeBlocks,
          codeLanguages: [...allLanguages].sort(),
          totalTables,
          totalLinks,
          totalInternalLinks,
          filesWithFrontmatter,
          averageWordsPerDoc: files.length ? Math.round(totalWords / files.length) : 0,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: create_document
// ---------------------------------------------------------------------------
server.tool(
  'create_document',
  'Create a new markdown document in the workspace. Creates parent directories if needed.',
  {
    path: z.string().describe('Relative path for the new document, e.g. "api/new-endpoint.md"'),
    content: z.string().describe('Markdown content for the new document'),
    title: z.string().optional().describe('Optional title — will be prepended as H1 if not already present in content'),
  },
  async ({ path: filePath, content, title }) => {
    const fullPath = safePath(filePath);
    if (fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File already exists: ${filePath}. Use update_document to modify it.` }], isError: true };
    }

    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });

    let finalContent = content;
    if (title && !content.startsWith('# ')) {
      finalContent = `# ${title}\n\n${content}`;
    }

    fs.writeFileSync(fullPath, finalContent, 'utf-8');
    const stats = getStats(finalContent);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          created: filePath,
          ...stats,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: update_document
// ---------------------------------------------------------------------------
server.tool(
  'update_document',
  'Update an existing markdown document. Supports full replace, append, prepend, or find-and-replace.',
  {
    path: z.string().describe('Relative path to the document'),
    mode: z.enum(['replace', 'append', 'prepend', 'find_replace']).describe('Update mode'),
    content: z.string().describe('New content (for replace/append/prepend) or replacement text (for find_replace)'),
    find: z.string().optional().describe('Text to find (required for find_replace mode)'),
  },
  async ({ path: filePath, mode, content: newContent, find }) => {
    const fullPath = safePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const existing = fs.readFileSync(fullPath, 'utf-8');
    let result: string;

    switch (mode) {
      case 'replace':
        result = newContent;
        break;
      case 'append':
        result = existing + '\n' + newContent;
        break;
      case 'prepend':
        result = newContent + '\n' + existing;
        break;
      case 'find_replace':
        if (!find) {
          return { content: [{ type: 'text' as const, text: 'Error: "find" is required for find_replace mode' }], isError: true };
        }
        if (!existing.includes(find)) {
          return { content: [{ type: 'text' as const, text: `Error: Could not find "${find}" in ${filePath}` }], isError: true };
        }
        result = existing.replace(find, newContent);
        break;
      default:
        return { content: [{ type: 'text' as const, text: `Error: Unknown mode: ${mode}` }], isError: true };
    }

    fs.writeFileSync(fullPath, result, 'utf-8');
    const stats = getStats(result);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          updated: filePath,
          mode,
          ...stats,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: rename_document
// ---------------------------------------------------------------------------
server.tool(
  'rename_document',
  'Rename or move a markdown document and automatically update all internal links across the workspace that reference it.',
  {
    oldPath: z.string().describe('Current relative path of the document'),
    newPath: z.string().describe('New relative path for the document'),
  },
  async ({ oldPath, newPath }) => {
    const fullOld = safePath(oldPath);
    const fullNew = safePath(newPath);

    if (!fs.existsSync(fullOld)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${oldPath}` }], isError: true };
    }
    if (fs.existsSync(fullNew)) {
      return { content: [{ type: 'text' as const, text: `Error: Destination already exists: ${newPath}` }], isError: true };
    }

    // Create destination directory
    fs.mkdirSync(path.dirname(fullNew), { recursive: true });

    // Move the file
    fs.renameSync(fullOld, fullNew);

    // Update links in all other files
    const allFiles = findMarkdownFiles(resolvedDir);
    let updatedFiles = 0;

    for (const f of allFiles) {
      const relative = path.relative(resolvedDir, f);
      const content = fs.readFileSync(f, 'utf-8');
      const links = extractLinks(content);
      let modified = content;
      let changed = false;

      for (const link of links) {
        if (link.isInternal) {
          const resolved = path.normalize(path.join(path.dirname(relative), link.href));
          if (resolved === oldPath) {
            const newRelativeLink = path.relative(path.dirname(relative), newPath);
            modified = modified.replace(`](${link.href})`, `](${newRelativeLink})`);
            changed = true;
          }
        }
      }

      if (changed) {
        fs.writeFileSync(f, modified, 'utf-8');
        updatedFiles++;
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          renamed: { from: oldPath, to: newPath },
          linksUpdated: updatedFiles,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_related_docs
// ---------------------------------------------------------------------------
server.tool(
  'get_related_docs',
  'Find documents related to a given document based on shared links and heading similarity.',
  {
    path: z.string().describe('Relative path to the source document'),
    maxResults: z.number().optional().describe('Maximum related docs to return (default: 5)'),
  },
  async ({ path: filePath, maxResults = 5 }) => {
    const fullPath = path.resolve(resolvedDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const sourceContent = fs.readFileSync(fullPath, 'utf-8');
    const sourceHeadings = new Set(extractHeadings(sourceContent).map((h) => h.text.toLowerCase()));
    const sourceLinks = new Set(extractLinks(sourceContent).map((l) => l.href.toLowerCase()));
    const sourceWords = new Set(
      sourceContent.toLowerCase().replace(/[#*`\[\]()>-]/g, '').split(/\s+/).filter((w) => w.length > 4)
    );

    const allFiles = findMarkdownFiles(resolvedDir);
    const scores: Array<{ file: string; score: number; reasons: string[] }> = [];

    for (const f of allFiles) {
      const relative = path.relative(resolvedDir, f);
      if (relative === filePath) continue;

      const content = fs.readFileSync(f, 'utf-8');
      const headings = extractHeadings(content).map((h) => h.text.toLowerCase());
      const links = extractLinks(content).map((l) => l.href.toLowerCase());
      const words = new Set(
        content.toLowerCase().replace(/[#*`\[\]()>-]/g, '').split(/\s+/).filter((w) => w.length > 4)
      );

      let score = 0;
      const reasons: string[] = [];

      // Shared headings (strong signal)
      const sharedHeadings = headings.filter((h) => sourceHeadings.has(h));
      if (sharedHeadings.length > 0) {
        score += sharedHeadings.length * 3;
        reasons.push(`${sharedHeadings.length} shared headings`);
      }

      // Links to this doc or shared link targets
      const linksToSource = links.filter((l) => l.includes(filePath.toLowerCase()));
      if (linksToSource.length > 0) {
        score += linksToSource.length * 5;
        reasons.push(`${linksToSource.length} links to this document`);
      }

      const sharedLinks = links.filter((l) => sourceLinks.has(l));
      if (sharedLinks.length > 0) {
        score += sharedLinks.length * 2;
        reasons.push(`${sharedLinks.length} shared link targets`);
      }

      // Word overlap (weak signal)
      let commonWords = 0;
      for (const w of words) {
        if (sourceWords.has(w)) commonWords++;
      }
      const overlapRatio = sourceWords.size > 0 ? commonWords / sourceWords.size : 0;
      if (overlapRatio > 0.3) {
        score += Math.round(overlapRatio * 5);
        reasons.push(`${Math.round(overlapRatio * 100)}% word overlap`);
      }

      if (score > 0) {
        scores.push({ file: relative, score, reasons });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const related = scores.slice(0, maxResults);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          source: filePath,
          relatedDocuments: related,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_glossary
// ---------------------------------------------------------------------------
server.tool(
  'get_glossary',
  'Extract key terms and definitions from the workspace. Looks for definition-style patterns (bold terms followed by descriptions, definition lists, etc).',
  {
    path: z.string().optional().describe('Relative path to a specific document. If omitted, scans all documents.'),
  },
  async ({ path: filePath }) => {
    const filesToScan = filePath
      ? [path.resolve(resolvedDir, filePath)]
      : findMarkdownFiles(resolvedDir);

    if (filePath && !fs.existsSync(filesToScan[0])) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const glossary: Array<{ term: string; definition: string; source: string; line: number }> = [];

    for (const f of filesToScan) {
      const relative = path.relative(resolvedDir, f);
      const content = fs.readFileSync(f, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Pattern 1: **Term**: definition or **Term** — definition
        const boldDefn = line.match(/^\s*\*\*(.+?)\*\*\s*[-:—]\s*(.+)/);
        if (boldDefn) {
          glossary.push({ term: boldDefn[1].trim(), definition: boldDefn[2].trim(), source: relative, line: i + 1 });
          continue;
        }

        // Pattern 2: - **Term**: definition (list item)
        const listDefn = line.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*[-:—]\s*(.+)/);
        if (listDefn) {
          glossary.push({ term: listDefn[1].trim(), definition: listDefn[2].trim(), source: relative, line: i + 1 });
          continue;
        }

        // Pattern 3: Term\n: definition (definition list)
        if (i + 1 < lines.length && lines[i + 1].match(/^:\s+.+/)) {
          const term = line.trim();
          const def = lines[i + 1].replace(/^:\s+/, '').trim();
          if (term && !term.startsWith('#') && !term.startsWith('-') && term.length < 60) {
            glossary.push({ term, definition: def, source: relative, line: i + 1 });
          }
        }

        // Pattern 4: H3/H4 heading followed by text (common in glossary pages)
        const heading = line.match(/^#{3,4}\s+(.+)/);
        if (heading && i + 1 < lines.length && i + 2 < lines.length) {
          const nextLine = lines[i + 1].trim();
          const nextNextLine = lines[i + 2].trim();
          // Skip if next line is another heading or empty
          if (nextLine === '' && nextNextLine && !nextNextLine.startsWith('#')) {
            glossary.push({ term: heading[1].trim(), definition: nextNextLine, source: relative, line: i + 1 });
          }
        }
      }
    }

    // Deduplicate by term
    const seen = new Set<string>();
    const unique = glossary.filter((g) => {
      const key = g.term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => a.term.localeCompare(b.term));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          totalTerms: unique.length,
          glossary: unique,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`markview-mcp server running on ${resolvedDir} — 15 tools available`);
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
