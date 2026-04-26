#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebRTCServerTransport } from './webrtc-transport.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

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

/** Extract links from markdown content.
 *
 * Recognises two link kinds:
 *   - `inline` — standard markdown `[text](href)`
 *   - `wiki`   — Obsidian-style `[[slug]]`, `[[slug|alias]]`, `[[slug#heading]]`, `![[embed]]`
 *
 * Lines inside fenced code blocks (``` … ```) are skipped, and inline code
 * spans (`like this`) are masked out within each line, to avoid false
 * positives like `${var}` template literals, example URLs in code samples,
 * or framework-specific dynamic-route syntax such as Cloudflare Pages
 * `functions/hf/[[path]].ts` (which is literal code, not a wiki link).
 *
 * For wiki links, `href` is the bare slug (no `.md`, no path). Resolution
 * to a real file is the caller's job — the slug must be looked up against
 * the workspace slug index (basename + permalink frontmatter).
 */
function extractLinks(content: string): Array<{ text: string; href: string; line: number; isInternal: boolean; kind: 'inline' | 'wiki' }> {
  const links: Array<{ text: string; href: string; line: number; isInternal: boolean; kind: 'inline' | 'wiki' }> = [];
  const lines = content.split('\n');
  const inlineRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  // Match [[target]], [[target|alias]], [[target#heading]], and ![[embed]] forms.
  const wikiRegex = /!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
  // Replace inline code spans with same-length whitespace so positions stay consistent.
  const inlineCodeRegex = /`[^`\n]+`/g;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Toggle fenced-code-block state on lines that start with ``` or ~~~ (allowing leading whitespace).
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Mask inline code spans before matching. Brackets inside `…` are literal
    // text (e.g. `[[path]]` from CF Pages routes, `[[wikilinks]]` example prose),
    // not real wiki links, so we erase them here.
    const sanitized = line.replace(inlineCodeRegex, (m) => ' '.repeat(m.length));

    let match: RegExpExecArray | null;

    inlineRegex.lastIndex = 0;
    while ((match = inlineRegex.exec(sanitized)) !== null) {
      const href = match[2];
      const isInternal = !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#') && !href.startsWith('mailto:');
      links.push({ text: match[1], href, line: i + 1, isInternal, kind: 'inline' });
    }

    wikiRegex.lastIndex = 0;
    while ((match = wikiRegex.exec(sanitized)) !== null) {
      const slug = match[1].trim();
      const alias = match[2]?.trim();
      links.push({ text: alias || slug, href: slug, line: i + 1, isInternal: true, kind: 'wiki' });
    }
  }
  return links;
}

/** Build a slug → relative-path index for wiki-link resolution.
 *
 * Wiki links reference notes by basename (e.g. `[[swarm-engine]]` → `projects/swarm-engine.md`)
 * or by the canonical permalink declared in frontmatter (e.g. `permalink: html-in-canvas-session-001-stages-1-2`
 * for a file at `projects/html-in-canvas/sessions/001-stages-1-2.md`).
 *
 * Resolution order at lookup time: basename first, then permalink fallback. Multiple files may
 * share a basename or permalink; we keep the first occurrence and surface ambiguity via the
 * duplicates set so callers can warn.
 */
function buildSlugIndex(resolvedDir: string, allFiles: string[]): { byBase: Map<string, string>; byPermalink: Map<string, string>; duplicates: Set<string> } {
  const byBase = new Map<string, string>();
  const byPermalink = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const f of allFiles) {
    const rel = path.relative(resolvedDir, f);
    const base = path.basename(rel, path.extname(rel));
    if (byBase.has(base)) {
      duplicates.add(base);
    } else {
      byBase.set(base, rel);
    }

    // Index by frontmatter `permalink` field, when present and distinct from basename.
    try {
      const content = fs.readFileSync(f, 'utf-8');
      const fm = parseFrontmatter(content);
      const permalink = fm?.data?.permalink?.trim();
      if (permalink && permalink !== base) {
        if (byPermalink.has(permalink)) {
          duplicates.add(permalink);
        } else {
          byPermalink.set(permalink, rel);
        }
      }
    } catch {
      // Read errors are surfaced elsewhere; skip indexing this file's permalink.
    }
  }
  return { byBase, byPermalink, duplicates };
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

/** Extract Mermaid diagrams from markdown */
function extractMermaidDiagrams(content: string): Array<{ type: string; code: string; line: number }> {
  const blocks = extractCodeBlocks(content);
  return blocks
    .filter((b) => b.language.toLowerCase() === 'mermaid')
    .map((b) => {
      const firstLine = b.code.trim().split('\n')[0].trim().toLowerCase();
      let type = 'unknown';
      if (firstLine.startsWith('graph') || firstLine.startsWith('flowchart')) type = 'flowchart';
      else if (firstLine.startsWith('sequencediagram')) type = 'sequence';
      else if (firstLine.startsWith('classdiagram')) type = 'class';
      else if (firstLine.startsWith('statediagram')) type = 'state';
      else if (firstLine.startsWith('erdiagram')) type = 'er';
      else if (firstLine.startsWith('gantt')) type = 'gantt';
      else if (firstLine.startsWith('pie')) type = 'pie';
      else if (firstLine.startsWith('gitgraph')) type = 'gitgraph';
      else if (firstLine.startsWith('journey')) type = 'journey';
      else if (firstLine.startsWith('mindmap')) type = 'mindmap';
      else if (firstLine.startsWith('timeline')) type = 'timeline';
      else if (firstLine.startsWith('sankey')) type = 'sankey';
      else if (firstLine.startsWith('xychart')) type = 'xychart';
      else if (firstLine.startsWith('block')) type = 'block';
      return { type, code: b.code, line: b.line };
    });
}

/** Extract math blocks (KaTeX/LaTeX) from markdown */
function extractMathBlocks(content: string): Array<{ expression: string; type: 'inline' | 'display'; line: number }> {
  const results: Array<{ expression: string; type: 'inline' | 'display'; line: number }> = [];
  const lines = content.split('\n');

  // Display math: $$...$$
  let inDisplay = false;
  let displayStart = 0;
  let displayLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inDisplay && line.trim().startsWith('$$')) {
      // Check for single-line display math: $$...$$
      const singleLine = line.trim();
      if (singleLine.endsWith('$$') && singleLine.length > 4) {
        results.push({ expression: singleLine.slice(2, -2).trim(), type: 'display', line: i + 1 });
        continue;
      }
      inDisplay = true;
      displayStart = i;
      displayLines = [line.trim().slice(2)];
    } else if (inDisplay && line.trim().endsWith('$$')) {
      displayLines.push(line.trim().slice(0, -2));
      results.push({ expression: displayLines.join('\n').trim(), type: 'display', line: displayStart + 1 });
      inDisplay = false;
      displayLines = [];
    } else if (inDisplay) {
      displayLines.push(line);
    } else {
      // Inline math: $...$
      const inlineRegex = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;
      let match;
      while ((match = inlineRegex.exec(line)) !== null) {
        results.push({ expression: match[1].trim(), type: 'inline', line: i + 1 });
      }
    }
  }
  return results;
}

/** Generate table of contents markdown from headings */
function generateTocMarkdown(content: string, maxDepth: number = 3): string {
  const headings = extractHeadings(content);
  if (headings.length === 0) return '';

  const minLevel = Math.min(...headings.map((h) => h.level));
  const tocLines: string[] = [];

  for (const h of headings) {
    const relativeLevel = h.level - minLevel;
    if (relativeLevel >= maxDepth) continue;
    const indent = '  '.repeat(relativeLevel);
    const slug = h.text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    tocLines.push(`${indent}- [${h.text}](#${slug})`);
  }

  return tocLines.join('\n');
}

/** Calculate Flesch-Kincaid readability scores */
function fleschKincaid(text: string): { gradeLevel: number; readingEase: number; avgSentenceLength: number; avgSyllablesPerWord: number } {
  // Strip markdown syntax
  const clean = text.replace(/```[\s\S]*?```/g, '').replace(/[#*`\[\]()>-]/g, '').trim();
  if (!clean) return { gradeLevel: 0, readingEase: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0 };

  const sentences = clean.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0 || sentences.length === 0) {
    return { gradeLevel: 0, readingEase: 0, avgSentenceLength: 0, avgSyllablesPerWord: 0 };
  }

  // Count syllables (simple heuristic)
  function countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 2) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? Math.max(1, matches.length) : 1;
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;
  const readingEase = 206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord;

  return {
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    readingEase: Math.round(readingEase * 10) / 10,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
  };
}

/** Compress markdown content into a MarkView share URL */
function compressToShareUrl(content: string, title?: string): string {
  const compressed = zlib.gzipSync(Buffer.from(content, 'utf-8'));
  const base64 = compressed.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const params = new URLSearchParams();
  params.set('md', base64);
  if (title) params.set('title', title);

  return `https://markview.ai/#${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

// Parse arguments
let docsDir = '.';
let useWebRtc = false;
let webrtcRoom = '';
let signalingUrl = 'ws://localhost:4445';

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--webrtc') useWebRtc = true;
  else if (arg === '--room') webrtcRoom = process.argv[++i];
  else if (arg === '--signaling') signalingUrl = process.argv[++i];
  else if (!arg.startsWith('-')) docsDir = arg;
}

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
    const slugIndex = buildSlugIndex(resolvedDir, allFiles);

    const processFile = (fPath: string) => {
      const content = fs.readFileSync(fPath, 'utf-8');
      let links = extractLinks(content);
      if (internalOnly) links = links.filter((l) => l.isInternal);

      const relative = path.relative(resolvedDir, fPath);
      return {
        file: relative,
        links: links.map((l) => {
          if (!l.isInternal) return l;
          if (l.kind === 'wiki') {
            const resolved = slugIndex.byBase.get(l.href) ?? slugIndex.byPermalink.get(l.href);
            return { ...l, resolvedPath: resolved ?? null, exists: resolved !== undefined };
          }
          const cleanHref = l.href.split('#')[0].split('?')[0];
          const resolved = path.normalize(path.join(path.dirname(relative), cleanHref));
          return { ...l, resolvedPath: resolved, exists: allRelative.has(resolved) };
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
    const slugIndex = buildSlugIndex(resolvedDir, allFiles);

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
        if (!link.isInternal) continue;
        if (link.kind === 'wiki') {
          const target = slugIndex.byBase.get(link.href) ?? slugIndex.byPermalink.get(link.href);
          if (target) {
            linkedTo.add(target);
          } else {
            issues.push({
              type: 'broken_link',
              severity: 'error',
              file: relative,
              message: `Broken wiki link to "[[${link.href}]]" — no file matches that basename or permalink (line ${link.line})`,
            });
          }
        } else {
          // Inline [text](path.md) — strip URL fragment/query, then resolve relative to the source file.
          const cleanHref = link.href.split('#')[0].split('?')[0];
          if (!cleanHref) continue;
          const resolved = path.normalize(path.join(path.dirname(relative), cleanHref));
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

    // Surface basename ambiguity (multiple files share a slug → wiki links resolve nondeterministically).
    for (const dup of slugIndex.duplicates) {
      issues.push({
        type: 'ambiguous_slug',
        severity: 'warning',
        file: slugIndex.byBase.get(dup) || dup,
        message: `Basename "${dup}" is shared by multiple files; wiki links to [[${dup}]] resolve to only one of them`,
      });
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

    // Update links in all other files. Two link kinds need rewriting:
    //   - inline `[text](path.md)` — resolve against the file's directory and match oldPath
    //   - wiki `[[basename]]` (and aliased / anchored / embed forms) — match by basename
    const allFiles = findMarkdownFiles(resolvedDir);
    let updatedFiles = 0;
    const oldBase = path.basename(oldPath, path.extname(oldPath));
    const newBase = path.basename(newPath, path.extname(newPath));
    const oldBaseEscaped = oldBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the basename inside [[...]] or ![[...]], stopping at ], |, or # so aliases and headings are preserved.
    const wikiBaseRegex = new RegExp(`(!?\\[\\[)${oldBaseEscaped}(?=[\\]|#])`, 'g');

    for (const f of allFiles) {
      const relative = path.relative(resolvedDir, f);
      const content = fs.readFileSync(f, 'utf-8');
      const links = extractLinks(content);
      let modified = content;
      let changed = false;

      // 1) Inline links — substring replace with the link's exact href.
      for (const link of links) {
        if (link.kind !== 'inline' || !link.isInternal) continue;
        const cleanHref = link.href.split('#')[0].split('?')[0];
        const resolved = path.normalize(path.join(path.dirname(relative), cleanHref));
        if (resolved === oldPath) {
          const newRelativeLink = path.relative(path.dirname(relative), newPath);
          modified = modified.replace(`](${link.href})`, `](${newRelativeLink})`);
          changed = true;
        }
      }

      // 2) Wiki links — rewrite by basename only if the rename changed the basename.
      if (oldBase !== newBase && links.some((l) => l.kind === 'wiki' && l.href === oldBase)) {
        modified = modified.replace(wikiBaseRegex, `$1${newBase}`);
        changed = true;
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
// Tool: delete_document
// ---------------------------------------------------------------------------
server.tool(
  'delete_document',
  'Delete a markdown document from the workspace. Returns the document stats before deletion.',
  {
    path: z.string().describe('Relative path to the document to delete'),
  },
  async ({ path: filePath }) => {
    const fullPath = safePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const stats = getStats(content);
    fs.unlinkSync(fullPath);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ deleted: filePath, ...stats }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_mermaid_diagrams
// ---------------------------------------------------------------------------
server.tool(
  'get_mermaid_diagrams',
  'Extract all Mermaid diagrams from a document or workspace. Returns diagram type (flowchart, sequence, etc.), code, and line numbers.',
  {
    path: z.string().optional().describe('Relative path to a specific document. If omitted, scans all documents.'),
    type: z.string().optional().describe('Filter by diagram type, e.g. "flowchart", "sequence", "gantt"'),
  },
  async ({ path: filePath, type: diagramType }) => {
    const filesToScan = filePath
      ? [path.resolve(resolvedDir, filePath)]
      : findMarkdownFiles(resolvedDir);

    if (filePath && !fs.existsSync(filesToScan[0])) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const results = filesToScan.map((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      let diagrams = extractMermaidDiagrams(content);
      if (diagramType) {
        diagrams = diagrams.filter((d) => d.type === diagramType.toLowerCase());
      }
      return { file: path.relative(resolvedDir, f), diagrams };
    }).filter((r) => r.diagrams.length > 0);

    const totalDiagrams = results.reduce((a, r) => a + r.diagrams.length, 0);
    const types = [...new Set(results.flatMap((r) => r.diagrams.map((d) => d.type)))];

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ totalDiagrams, diagramTypes: types, files: results }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_math_blocks
// ---------------------------------------------------------------------------
server.tool(
  'get_math_blocks',
  'Extract all KaTeX/LaTeX math expressions from a document or workspace. Returns inline ($...$) and display ($$...$$) math with line numbers.',
  {
    path: z.string().optional().describe('Relative path to a specific document. If omitted, scans all documents.'),
    type: z.enum(['inline', 'display']).optional().describe('Filter by math type'),
  },
  async ({ path: filePath, type: mathType }) => {
    const filesToScan = filePath
      ? [path.resolve(resolvedDir, filePath)]
      : findMarkdownFiles(resolvedDir);

    if (filePath && !fs.existsSync(filesToScan[0])) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const results = filesToScan.map((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      let blocks = extractMathBlocks(content);
      if (mathType) blocks = blocks.filter((b) => b.type === mathType);
      return { file: path.relative(resolvedDir, f), blocks };
    }).filter((r) => r.blocks.length > 0);

    const totalBlocks = results.reduce((a, r) => a + r.blocks.length, 0);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ totalBlocks, files: results }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: generate_toc
// ---------------------------------------------------------------------------
server.tool(
  'generate_toc',
  'Generate a table of contents for a markdown document. Can return the TOC markdown or insert it into the document.',
  {
    path: z.string().describe('Relative path to the document'),
    maxDepth: z.number().optional().describe('Maximum heading depth to include (default: 3)'),
    insert: z.boolean().optional().describe('If true, insert the TOC at the top of the document (after the first H1)'),
  },
  async ({ path: filePath, maxDepth = 3, insert }) => {
    const fullPath = safePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const toc = generateTocMarkdown(content, maxDepth);

    if (!toc) {
      return { content: [{ type: 'text' as const, text: `No headings found in ${filePath}` }] };
    }

    const tocBlock = `<!-- TOC -->\n## Table of Contents\n\n${toc}\n<!-- /TOC -->`;

    if (insert) {
      const lines = content.split('\n');
      // Find first H1 and insert after it
      let insertIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^#\s+/)) {
          insertIdx = i + 1;
          break;
        }
      }
      // Remove existing TOC if present
      const existingTocStart = lines.findIndex((l) => l.trim() === '<!-- TOC -->');
      const existingTocEnd = lines.findIndex((l) => l.trim() === '<!-- /TOC -->');
      if (existingTocStart !== -1 && existingTocEnd !== -1) {
        lines.splice(existingTocStart, existingTocEnd - existingTocStart + 1);
        if (insertIdx > existingTocStart) insertIdx -= (existingTocEnd - existingTocStart + 1);
      }

      lines.splice(insertIdx, 0, '', tocBlock, '');
      fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ file: filePath, inserted: true, toc: tocBlock }, null, 2),
        }],
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ file: filePath, toc: tocBlock }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: merge_documents
// ---------------------------------------------------------------------------
server.tool(
  'merge_documents',
  'Merge multiple markdown documents into a single document.',
  {
    paths: z.array(z.string()).describe('Array of relative paths to merge, in order'),
    outputPath: z.string().describe('Relative path for the merged output document'),
    separator: z.string().optional().describe('Separator between merged documents (default: "\n\n---\n\n")'),
  },
  async ({ paths: filePaths, outputPath, separator = '\n\n---\n\n' }) => {
    const outputFull = safePath(outputPath);
    const parts: string[] = [];
    const merged: string[] = [];

    for (const fp of filePaths) {
      const fullPath = safePath(fp);
      if (!fs.existsSync(fullPath)) {
        return { content: [{ type: 'text' as const, text: `Error: File not found: ${fp}` }], isError: true };
      }
      parts.push(fs.readFileSync(fullPath, 'utf-8'));
      merged.push(fp);
    }

    const result = parts.join(separator);
    fs.mkdirSync(path.dirname(outputFull), { recursive: true });
    fs.writeFileSync(outputFull, result, 'utf-8');
    const stats = getStats(result);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          outputPath,
          mergedFiles: merged,
          ...stats,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: share_document
// ---------------------------------------------------------------------------
server.tool(
  'share_document',
  'Generate a MarkView share URL for a markdown document. The URL contains the compressed content and can be opened by anyone in their browser — no server needed.',
  {
    path: z.string().describe('Relative path to the document to share'),
    title: z.string().optional().describe('Optional title override for the shared document'),
  },
  async ({ path: filePath, title }) => {
    const fullPath = safePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const docTitle = title || path.basename(filePath, '.md');
    const url = compressToShareUrl(content, docTitle);
    const stats = getStats(content);

    const MAX_SAFE_LENGTH = 15000;
    const warning = content.length > MAX_SAFE_LENGTH
      ? 'Warning: Document is large. The URL may not work in all browsers due to URL length limits.'
      : undefined;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          url,
          title: docTitle,
          contentLength: content.length,
          urlLength: url.length,
          ...stats,
          ...(warning ? { warning } : {}),
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: render_document
// ---------------------------------------------------------------------------
server.tool(
  'render_document',
  'Render a markdown document to a standalone HTML file with support for Mermaid diagrams, KaTeX math, and syntax highlighting via CDN scripts.',
  {
    path: z.string().describe('Relative path to the markdown document'),
    outputPath: z.string().optional().describe('Output HTML file path (default: same name with .html extension)'),
    theme: z.enum(['light', 'dark']).optional().describe('Color theme (default: dark)'),
    title: z.string().optional().describe('HTML page title override'),
  },
  async ({ path: filePath, outputPath, theme = 'dark', title }) => {
    const fullPath = safePath(filePath);
    if (!fs.existsSync(fullPath)) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const docTitle = title || path.basename(filePath, '.md');
    const hasMermaid = content.includes('```mermaid');
    const hasMath = content.includes('$');

    const isDark = theme === 'dark';
    const bg = isDark ? '#0a0a0a' : '#ffffff';
    const fg = isDark ? '#fafafa' : '#18181b';
    const mutedFg = isDark ? '#a1a1aa' : '#71717a';
    const codeBg = isDark ? '#18181b' : '#f4f4f5';
    const borderColor = isDark ? '#27272a' : '#e4e4e7';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} — MarkView</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${bg}; color: ${fg}; line-height: 1.7; padding: 48px 24px; max-width: 820px; margin: 0 auto; }
    h1, h2, h3, h4, h5, h6 { margin: 1.5em 0 0.5em; font-weight: 600; line-height: 1.3; }
    h1 { font-size: 2.2em; border-bottom: 1px solid ${borderColor}; padding-bottom: 0.3em; }
    h2 { font-size: 1.6em; border-bottom: 1px solid ${borderColor}; padding-bottom: 0.2em; }
    h3 { font-size: 1.3em; }
    p { margin: 0.8em 0; }
    a { color: #818cf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background: ${codeBg}; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: ${codeBg}; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 1em 0; border: 1px solid ${borderColor}; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #818cf8; padding: 0.5em 1em; margin: 1em 0; color: ${mutedFg}; background: ${codeBg}; border-radius: 0 8px 8px 0; }
    ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
    li { margin: 0.3em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid ${borderColor}; padding: 8px 12px; text-align: left; }
    th { background: ${codeBg}; font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    hr { border: none; border-top: 1px solid ${borderColor}; margin: 2em 0; }
    .mermaid { text-align: center; margin: 1.5em 0; }
    .markview-footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid ${borderColor}; text-align: center; color: ${mutedFg}; font-size: 0.85em; }
    .markview-footer a { color: #818cf8; }
  </style>
  ${hasMath ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">' : ''}
</head>
<body>
  <div id="content">${escapeHtml(content)}</div>
  <div class="markview-footer">
    <p>Rendered by <a href="https://markview.ai" target="_blank">MarkView</a></p>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  ${hasMermaid ? '<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>' : ''}
  ${hasMath ? '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>\n  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>' : ''}
  <script>
    const raw = document.getElementById('content').textContent;
    document.getElementById('content').innerHTML = marked.parse(raw);
    ${hasMermaid ? `mermaid.initialize({ startOnLoad: false, theme: '${isDark ? 'dark' : 'default'}' });
    document.querySelectorAll('pre code.language-mermaid, pre code').forEach(el => {
      if (el.className.includes('mermaid') || el.parentElement.previousElementSibling?.textContent?.includes('mermaid')) return;
    });
    mermaid.run();` : ''}
    ${hasMath ? "renderMathInElement(document.getElementById('content'), { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }] });" : ''}
  </script>
</body>
</html>`;

    const outFile = outputPath
      ? safePath(outputPath)
      : fullPath.replace(/\.md$/i, '.html');

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, 'utf-8');

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          rendered: path.relative(resolvedDir, outFile),
          source: filePath,
          theme,
          hasMermaid,
          hasMath,
          htmlSize: html.length,
        }, null, 2),
      }],
    };
  }
);

/** Escape HTML entities for safe embedding */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Tool: analyze_reading_level
// ---------------------------------------------------------------------------
server.tool(
  'analyze_reading_level',
  'Analyze the readability of a document or the entire workspace using Flesch-Kincaid scoring. Returns grade level, reading ease, and related metrics.',
  {
    path: z.string().optional().describe('Relative path to a specific document. If omitted, analyzes all documents.'),
  },
  async ({ path: filePath }) => {
    const filesToScan = filePath
      ? [path.resolve(resolvedDir, filePath)]
      : findMarkdownFiles(resolvedDir);

    if (filePath && !fs.existsSync(filesToScan[0])) {
      return { content: [{ type: 'text' as const, text: `Error: File not found: ${filePath}` }], isError: true };
    }

    const results = filesToScan.map((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      const scores = fleschKincaid(content);
      let level = 'Unknown';
      if (scores.readingEase >= 90) level = 'Very Easy (5th grade)';
      else if (scores.readingEase >= 80) level = 'Easy (6th grade)';
      else if (scores.readingEase >= 70) level = 'Fairly Easy (7th grade)';
      else if (scores.readingEase >= 60) level = 'Standard (8-9th grade)';
      else if (scores.readingEase >= 50) level = 'Fairly Difficult (10-12th grade)';
      else if (scores.readingEase >= 30) level = 'Difficult (College)';
      else level = 'Very Difficult (Graduate)';

      return { file: path.relative(resolvedDir, f), ...scores, level };
    });

    if (results.length === 1) {
      return { content: [{ type: 'text' as const, text: JSON.stringify(results[0], null, 2) }] };
    }

    const avgEase = results.reduce((a, r) => a + r.readingEase, 0) / results.length;
    const avgGrade = results.reduce((a, r) => a + r.gradeLevel, 0) / results.length;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          totalFiles: results.length,
          averageReadingEase: Math.round(avgEase * 10) / 10,
          averageGradeLevel: Math.round(avgGrade * 10) / 10,
          documents: results,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Vault graph queries
// ---------------------------------------------------------------------------
// Plain BFS + label propagation over an in-memory undirected adjacency built
// from wikilinks and relative markdown links. At workspace scale (<10k files)
// this dwarfs anything fancier — no need for sparse-matrix or GPU paths here.
// The adjacency is rebuilt per call so any file edit between tool invocations
// is reflected; the underlying I/O dominates and is what we'd cache first if
// it ever got slow.

type Adjacency = Map<string, Set<string>>;

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
const MD_LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** Lower-cased file stem (no extension, no path), used as the key for both
 *  wikilink targets and absolute/relative markdown link targets. */
function normStem(raw: string): string {
  const noFragment = raw.split(/[#?]/)[0];
  const parts = noFragment.split('/');
  const last = parts[parts.length - 1] ?? noFragment;
  return last.trim().replace(/\.(md|markdown)$/i, '').toLowerCase();
}

function buildVaultAdjacency(): { adjacency: Adjacency; paths: string[] } {
  const files = findMarkdownFiles(resolvedDir);
  const paths = files.map((f) => path.relative(resolvedDir, f));
  const stemIndex = new Map<string, string>();
  for (const rel of paths) stemIndex.set(normStem(rel), rel);

  const adjacency: Adjacency = new Map();
  for (const rel of paths) adjacency.set(rel, new Set());

  for (let i = 0; i < files.length; i++) {
    const self = paths[i];
    const content = fs.readFileSync(files[i], 'utf-8');
    const targets = new Set<string>();

    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(content))) {
      const t = stemIndex.get(normStem(m[1]));
      if (t && t !== self) targets.add(t);
    }
    MD_LINK_RE.lastIndex = 0;
    while ((m = MD_LINK_RE.exec(content))) {
      const href = m[1];
      if (/^https?:/i.test(href) || /^mailto:/i.test(href) || href.startsWith('#')) continue;
      const t = stemIndex.get(normStem(href));
      if (t && t !== self) targets.add(t);
    }

    for (const t of targets) {
      adjacency.get(self)!.add(t);
      adjacency.get(t)!.add(self);
    }
  }

  return { adjacency, paths };
}

function bfsKHop(adj: Adjacency, start: string, k: number): Array<{ path: string; hops: number }> {
  if (k < 1 || !adj.has(start)) return [];
  const visited = new Set<string>([start]);
  const out: Array<{ path: string; hops: number }> = [];
  let frontier: string[] = [start];
  for (let depth = 1; depth <= k && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const u of frontier) {
      for (const v of adj.get(u) ?? []) {
        if (visited.has(v)) continue;
        visited.add(v);
        out.push({ path: v, hops: depth });
        next.push(v);
      }
    }
    frontier = next;
  }
  return out;
}

function bfsShortestPath(adj: Adjacency, source: string, target: string): string[] | null {
  if (source === target) return adj.has(source) ? [source] : null;
  if (!adj.has(source) || !adj.has(target)) return null;
  const prev = new Map<string, string>();
  const visited = new Set<string>([source]);
  let frontier: string[] = [source];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const u of frontier) {
      for (const v of adj.get(u) ?? []) {
        if (visited.has(v)) continue;
        visited.add(v);
        prev.set(v, u);
        if (v === target) {
          const path = [target];
          let cur = u;
          while (cur !== source) {
            path.push(cur);
            cur = prev.get(cur)!;
          }
          path.push(source);
          return path.reverse();
        }
        next.push(v);
      }
    }
    frontier = next;
  }
  return null;
}

function inducedEgoGraph(adj: Adjacency, center: string, k: number): { nodes: string[]; edges: Array<[string, string]> } {
  if (!adj.has(center)) return { nodes: [], edges: [] };
  const hits = bfsKHop(adj, center, k);
  const nodes = [center, ...hits.map((h) => h.path)];
  const set = new Set(nodes);
  const edges: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const u of nodes) {
    for (const v of adj.get(u) ?? []) {
      if (!set.has(v)) continue;
      const key = u < v ? `${u}|${v}` : `${v}|${u}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([u, v]);
    }
  }
  return { nodes, edges };
}

function labelPropagation(adj: Adjacency, maxIterations: number): Map<string, string> {
  const nodes = Array.from(adj.keys()).sort();
  const label = new Map<string, string>();
  for (const id of nodes) label.set(id, id);
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    for (const u of nodes) {
      const nbrs = adj.get(u);
      if (!nbrs || nbrs.size === 0) continue;
      const counts = new Map<string, number>();
      for (const v of nbrs) {
        const lab = label.get(v)!;
        counts.set(lab, (counts.get(lab) ?? 0) + 1);
      }
      let bestLabel = label.get(u)!;
      let bestCount = -1;
      for (const [lab, count] of counts) {
        if (count > bestCount || (count === bestCount && lab < bestLabel)) {
          bestLabel = lab;
          bestCount = count;
        }
      }
      if (label.get(u) !== bestLabel) {
        label.set(u, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return label;
}

// ---------------------------------------------------------------------------
// Tool: get_related_within_hops
// ---------------------------------------------------------------------------
server.tool(
  'get_related_within_hops',
  'List all documents reachable from a starting document within N link hops. Uses both [[wikilinks]] and relative markdown links to build the graph.',
  {
    path: z.string().describe('Relative path to the source document, e.g. "projects/x.md"'),
    hops: z.number().int().min(1).max(6).optional().describe('Maximum hop distance (default: 2, max: 6)'),
  },
  async ({ path: filePath, hops = 2 }) => {
    const { adjacency } = buildVaultAdjacency();
    if (!adjacency.has(filePath)) {
      return {
        content: [{ type: 'text' as const, text: `Error: Document not found in vault: ${filePath}` }],
        isError: true,
      };
    }
    const hits = bfsKHop(adjacency, filePath, hops);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          source: filePath,
          hops,
          totalRelated: hits.length,
          related: hits,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_shortest_path
// ---------------------------------------------------------------------------
server.tool(
  'get_shortest_path',
  'Find the shortest hop-count path between two documents through the link graph. Returns the path inclusive of both endpoints, or null if unreachable.',
  {
    from: z.string().describe('Relative path to the source document'),
    to: z.string().describe('Relative path to the target document'),
  },
  async ({ from, to }) => {
    const { adjacency } = buildVaultAdjacency();
    const path = bfsShortestPath(adjacency, from, to);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          from,
          to,
          reachable: path !== null,
          hops: path ? path.length - 1 : null,
          path,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_ego_graph
// ---------------------------------------------------------------------------
server.tool(
  'get_ego_graph',
  'Return the induced subgraph (nodes + edges) within N hops of a center document. Useful for visualizing or summarizing a local neighborhood.',
  {
    path: z.string().describe('Relative path to the center document'),
    hops: z.number().int().min(1).max(4).optional().describe('Hop radius (default: 2, max: 4)'),
  },
  async ({ path: filePath, hops = 2 }) => {
    const { adjacency } = buildVaultAdjacency();
    if (!adjacency.has(filePath)) {
      return {
        content: [{ type: 'text' as const, text: `Error: Document not found in vault: ${filePath}` }],
        isError: true,
      };
    }
    const ego = inducedEgoGraph(adjacency, filePath, hops);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          center: filePath,
          hops,
          nodeCount: ego.nodes.length,
          edgeCount: ego.edges.length,
          nodes: ego.nodes,
          edges: ego.edges,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_vault_hubs
// ---------------------------------------------------------------------------
server.tool(
  'get_vault_hubs',
  'List the most-connected documents in the vault by degree (number of incident wikilinks/markdown links). Surfaces hub notes and indices.',
  {
    limit: z.number().int().min(1).max(100).optional().describe('How many top hubs to return (default: 10, max: 100)'),
  },
  async ({ limit = 10 }) => {
    const { adjacency } = buildVaultAdjacency();
    const ranked = Array.from(adjacency, ([p, nbrs]) => ({ path: p, degree: nbrs.size }))
      .sort((a, b) => (b.degree - a.degree) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .slice(0, limit);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          totalDocs: adjacency.size,
          hubs: ranked,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_communities
// ---------------------------------------------------------------------------
server.tool(
  'get_communities',
  'Cluster vault documents into communities via label propagation over the link graph. Returns each community with its member paths. Deterministic.',
  {
    minSize: z.number().int().min(1).optional().describe('Drop communities smaller than this many members (default: 1)'),
    maxIterations: z.number().int().min(1).max(100).optional().describe('Max label-propagation sweeps (default: 20)'),
  },
  async ({ minSize = 1, maxIterations = 20 }) => {
    const { adjacency } = buildVaultAdjacency();
    const labels = labelPropagation(adjacency, maxIterations);
    const grouped = new Map<string, string[]>();
    for (const [node, lab] of labels) {
      if (!grouped.has(lab)) grouped.set(lab, []);
      grouped.get(lab)!.push(node);
    }
    const communities = Array.from(grouped, ([label, members]) => ({
      label,
      size: members.length,
      members: members.sort(),
    }))
      .filter((c) => c.size >= minSize)
      .sort((a, b) => b.size - a.size || (a.label < b.label ? -1 : 1));
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          totalDocs: adjacency.size,
          communityCount: communities.length,
          communities,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// MCP Resources
// ---------------------------------------------------------------------------
server.resource(
  'workspace-overview',
  'markview://workspace/overview',
  { mimeType: 'application/json', description: 'Overview of the documentation workspace: file count, total words, languages, and health summary' },
  async () => {
    const files = findMarkdownFiles(resolvedDir);
    let totalWords = 0;
    const allLanguages = new Set<string>();
    let totalHeadings = 0;

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      totalWords += getStats(content).words;
      extractCodeBlocks(content).forEach((b) => allLanguages.add(b.language));
      totalHeadings += extractHeadings(content).length;
    }

    return {
      contents: [{
        uri: 'markview://workspace/overview',
        mimeType: 'application/json',
        text: JSON.stringify({
          directory: resolvedDir,
          totalFiles: files.length,
          totalWords,
          totalReadingTimeMinutes: Math.max(1, Math.ceil(totalWords / 230)),
          totalHeadings,
          codeLanguages: [...allLanguages].sort(),
          files: files.map((f) => path.relative(resolvedDir, f)),
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// MCP Prompts
// ---------------------------------------------------------------------------
server.prompt(
  'review-docs',
  'Run a comprehensive quality audit on the documentation workspace. Checks for broken links, missing titles, readability, and suggests improvements.',
  {},
  async () => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Please perform a thorough documentation quality review of my workspace. Use the following tools in order:

1. Call \`validate_workspace\` to find structural issues (broken links, orphans, missing titles, empty docs)
2. Call \`analyze_reading_level\` to check readability across all documents
3. Call \`get_stats\` for overall workspace metrics
4. Call \`get_links\` to audit the link graph

Then provide a structured report with:
- **Critical Issues**: Broken links, empty documents
- **Warnings**: Missing titles, orphan pages, readability concerns
- **Suggestions**: Improvements for structure, content, and consistency
- **Summary**: Overall health score and top 3 priority actions`,
      },
    }],
  })
);

server.prompt(
  'summarize-workspace',
  'Generate an executive summary of all documentation in the workspace.',
  {},
  async () => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Please create a concise executive summary of my documentation workspace. Use the following tools:

1. Call \`list_documents\` to see all available documents
2. Call \`get_stats\` for workspace-wide metrics
3. Call \`get_headings\` to understand the structure of each document
4. Read the most important documents using \`get_document\` (start with README, index, or getting-started files)

Then provide:
- **Overview**: What this documentation covers (1-2 sentences)
- **Key Documents**: List and briefly describe the most important documents
- **Structure**: How the docs are organized
- **Coverage**: Topics well-covered vs. potential gaps
- **Quick Reference**: A condensed table of contents across all docs`,
      },
    }],
  })
);

server.prompt(
  'generate-api-docs',
  'Generate API documentation by analyzing code blocks and existing documentation patterns in the workspace.',
  {
    topic: z.string().optional().describe('Specific API or feature area to document'),
  },
  async ({ topic }) => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: `Please help me generate API documentation${topic ? ` for: ${topic}` : ''}. Use the following tools:

1. Call \`get_code_blocks\` on relevant documents to find existing code examples
2. Call \`search_docs\` for any existing API references${topic ? ` related to "${topic}"` : ''}
3. Call \`get_frontmatter\` to understand the metadata conventions used
4. Call \`get_headings\` to see the existing documentation structure

Then generate comprehensive API documentation that includes:
- **Endpoint/Function signatures** with parameters and return types
- **Code examples** in the primary languages found in the workspace
- **Error handling** documentation
- **Usage notes** and best practices

Use \`create_document\` to write the generated documentation to an appropriate file path.`,
      },
    }],
  })
);

// ---------------------------------------------------------------------------
// Tool: save_to_vault
// ---------------------------------------------------------------------------
server.tool(
  'save_to_vault',
  'Save a Brain analysis or note to the Obsidian research vault',
  {
    title: z.string().describe('Title for the note'),
    content: z.string().describe('The analysis content to save'),
    url: z.string().describe('Source URL'),
    tags: z.string().optional().describe('Comma-separated tags'),
  },
  async ({ title, content, url, tags }) => {
    const vaultRoot = '/Users/ahmetbarisgunaydin2/Documents/research-vault';
    const brainDir = path.join(vaultRoot, 'brain-captures');

    // Ensure directory exists
    if (!fs.existsSync(brainDir)) {
      fs.mkdirSync(brainDir, { recursive: true });
    }

    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
    const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').substring(0, 60).trim().replace(/\s+/g, '-');
    const filename = `${dateStr}-${safeTitle}.md`;
    const filepath = path.join(brainDir, filename);

    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const tagYaml = tagList.length > 0 ? `tags: [${tagList.map(t => `"${t}"`).join(', ')}]` : '';

    const note = `---
title: "${title}"
source: "${url}"
captured: "${date.toISOString()}"
tool: "markview-brain"
${tagYaml}
---

# ${title}

> Captured from [${url}](${url}) on ${dateStr} at ${date.toLocaleTimeString()}

${content}

---
*Auto-captured by MarkView Brain · qwen3:0.6b · local inference*
`;

    fs.writeFileSync(filepath, note, 'utf-8');
    console.log(`[Brain] Saved to vault: ${filepath}`);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            saved: true,
            path: `brain-captures/${filename}`,
            message: `Saved to vault: ${filename}`,
          }),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// AI Pipeline Helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','can','shall',
  'to','of','in','for','on','with','at','by','from','this','that','these','those',
  'it','its','and','or','but','not','no','if','then','else','so','as','up','out',
  'about','into','over','after','before','skip','content','sign','log','you','your',
  'more','all','new','code','file','files','what','how','why','when','where','which',
  'who','tell','explain','describe','also','just','like','very','really','some',
  'than','them','they','their','there','here','only','even','each','every',
]);

function detectPageType(url: string): string {
  if (url.includes('github.com') && url.includes('/pull/')) return 'github-pr';
  if (url.includes('github.com') && url.includes('/issues/')) return 'github-issue';
  if (url.includes('github.com') && (url.includes('/blob/') || url.includes('/tree/'))) return 'github-code';
  if (url.includes('github.com')) return 'github-repo';
  if (url.includes('claude.ai') || url.includes('chatgpt.com')) return 'ai-chat';
  if (url.includes('arxiv.org')) return 'paper';
  if (url.includes('stackoverflow.com')) return 'stackoverflow';
  if (url.includes('docs.') || url.includes('documentation')) return 'docs';
  return 'generic';
}

/** Strip GitHub/web chrome noise and extract the meaningful content */
function extractSmartContext(url: string, raw: string, pageType: string): string {
  // Remove common noise patterns
  const noisePatterns = [
    /Skip to content/gi, /Navigation Menu/gi, /Sign in/gi, /Sign up/gi,
    /Footer navigation/gi, /Terms\s+Privacy/gi, /Cookie\s+policy/gi,
    /©\s*\d{4}/g, /Toggle navigation/gi, /Type\s*\/\s*to search/gi,
    /Dismiss\s*alert/gi, /You signed in with another tab/gi,
    /Notifications\s+Fork\s+Star/gi, /Watch\s+\d+/gi,
  ];

  let clean = raw;
  for (const p of noisePatterns) { clean = clean.replace(p, ''); }

  // Collapse whitespace
  clean = clean.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  const lines = clean.split('\n').filter(l => l.trim().length > 2);

  switch (pageType) {
    case 'github-pr': {
      const title = lines.find(l => l.length > 15 && !l.includes('Conversation') && !l.includes('Commits'))?.trim() || '';
      const fileLines = lines.filter(l => l.match(/\.(ts|js|py|go|rs|tsx|jsx|css|md|json|yaml|yml)\b/));
      const commentLines = lines.filter(l =>
        l.includes('commented') || l.includes('review') || l.includes('approved') ||
        l.includes('changes requested') || l.includes('merged')
      );
      const bodyLines = lines.filter(l =>
        l.length > 30 && !l.includes('Conversation') && !l.includes('Checks') &&
        !l.includes('Files changed') && !fileLines.includes(l)
      );
      return [
        `PR: ${title.substring(0, 200)}`,
        `Files: ${fileLines.slice(0, 15).join(', ').substring(0, 400)}`,
        `Reviews: ${commentLines.slice(0, 8).join(' | ').substring(0, 300)}`,
        `Body: ${bodyLines.slice(0, 10).join(' ').substring(0, 500)}`,
      ].join('\n');
    }
    case 'github-issue': {
      const title = lines.find(l => l.length > 15)?.trim() || '';
      const body = lines.filter(l => l.length > 20).slice(0, 20).join(' ');
      return `Issue: ${title.substring(0, 200)}\n${body.substring(0, 1200)}`;
    }
    case 'github-code': {
      // Extract the actual code content, skip navigation
      const codeStart = lines.findIndex(l => l.includes('lines') || l.match(/^\d+$/));
      const codeLines = codeStart > 0 ? lines.slice(codeStart) : lines.slice(Math.floor(lines.length * 0.3));
      return codeLines.join('\n').substring(0, 1500);
    }
    case 'ai-chat': {
      // Extract the conversation, skip UI chrome
      const msgLines = lines.filter(l => l.length > 15);
      return msgLines.slice(-30).join('\n').substring(0, 1500);
    }
    default:
      return lines.join('\n').substring(0, 1500);
  }
}

interface VaultSearchResult {
  files: string[];
  context: string;
  status: string;
}

/** TF-IDF-weighted vault search with relevant snippet extraction */
function searchVault(vaultRoot: string, searchText: string, maxResults: number): VaultSearchResult {
  // Extract and weight keywords
  const words = searchText.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) { freq[w] = (freq[w] || 0) + 1; }
  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  if (keywords.length === 0) {
    return { files: [], context: '', status: '❌ No keywords extracted' };
  }

  console.log(`[Brain] Search keywords: ${keywords.slice(0, 10).join(', ')}`);

  const allFiles = fs.readdirSync(vaultRoot, { recursive: true }) as string[];
  const mdFiles = allFiles
    .filter(f => typeof f === 'string' && f.endsWith('.md'))
    .map(f => path.join(vaultRoot, f));

  const scored: { file: string; score: number; snippet: string }[] = [];

  for (const filePath of mdFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lower = content.toLowerCase();
      let score = 0;

      // TF-IDF-like scoring: weight by keyword rarity (fewer matches = more specific = higher weight)
      for (const kw of keywords) {
        const matches = (lower.match(new RegExp(kw, 'g')) || []).length;
        if (matches > 0) {
          // Boost for exact matches in title/headers
          const inTitle = lower.split('\n')[0]?.includes(kw) ? 3 : 0;
          const inHeaders = (lower.match(new RegExp(`^#+.*${kw}`, 'gm')) || []).length * 2;
          score += matches + inTitle + inHeaders;
        }
      }

      if (score > 0) {
        // Extract the RELEVANT snippet — find the paragraph with highest keyword density
        const paragraphs = content.split(/\n\n+/);
        let bestPara = '';
        let bestParaScore = 0;
        for (const para of paragraphs) {
          if (para.length < 20) continue;
          const paraLower = para.toLowerCase();
          let pScore = 0;
          for (const kw of keywords) {
            if (paraLower.includes(kw)) pScore++;
          }
          if (pScore > bestParaScore) {
            bestParaScore = pScore;
            bestPara = para;
          }
        }

        scored.push({
          file: path.relative(vaultRoot, filePath),
          score,
          snippet: (bestPara || content.substring(0, 300)).substring(0, 400),
        });
      }
    } catch {}
  }

  scored.sort((a, b) => b.score - a.score);
  const topFiles = scored.slice(0, maxResults);

  if (topFiles.length === 0) {
    // Fallback to AGENTS.md
    try {
      const agentDoc = fs.readFileSync(path.join(vaultRoot, 'AGENTS.md'), 'utf-8');
      return {
        files: ['AGENTS.md'],
        context: agentDoc.substring(0, 500),
        status: '✅ AGENTS.md (fallback)',
      };
    } catch {
      return { files: [], context: '', status: '❌ No matches' };
    }
  }

  const vaultContext = topFiles.map(f =>
    `[${f.file}] (score: ${f.score})\n${f.snippet}`
  ).join('\n\n');

  return {
    files: topFiles.map(f => f.file),
    context: vaultContext,
    status: `✅ ${topFiles.length} matched (${scored.length} total)`,
  };
}

interface PromptParams {
  pageType: string; url: string; cleanedContext: string; vaultContext: string;
  isChat: boolean; question: string; history: string;
}

function buildPrompt(p: PromptParams): string {
  // Summarize long chat history to save tokens
  let historyBlock = '';
  if (p.isChat && p.history) {
    try {
      const msgs = JSON.parse(p.history) as { role: string; content: string }[];
      // Keep last 4 exchanges, summarize older ones
      if (msgs.length > 8) {
        const older = msgs.slice(0, -8);
        const recent = msgs.slice(-8);
        const olderSummary = older.map(m => `${m.role}: ${m.content.substring(0, 50)}`).join('; ');
        historyBlock = `Earlier: ${olderSummary}\n\n` +
          recent.map(m => `${m.role === 'user' ? 'User' : 'Brain'}: ${m.content}`).join('\n');
      } else {
        historyBlock = msgs.map(m =>
          `${m.role === 'user' ? 'User' : 'Brain'}: ${m.content}`
        ).join('\n');
      }
    } catch {}
  }

  const systemPreamble = `/no_think\nYou are Brain, a concise research assistant. You analyze web pages and connect them to the user's Obsidian research vault. Rules:\n- Be specific and direct. No filler.\n- Reference actual content from the page and vault.\n- 2-4 sentences max unless asked for more.\n- No markdown formatting, no bullet points. Plain text only.\n`;

  if (p.isChat) {
    return `${systemPreamble}
Page (${p.pageType}): ${p.url}
Content: ${p.cleanedContext.substring(0, 800)}

${p.vaultContext ? `Vault notes:\n${p.vaultContext.substring(0, 600)}\n` : ''}
${historyBlock ? `Chat history:\n${historyBlock}\n` : ''}
User: ${p.question}
Brain:`;
  }

  // Page-type-specific analysis prompts
  const typeInstructions: Record<string, string> = {
    'github-pr': 'Analyze this PR: what it changes, its impact, risks, and how it connects to the vault notes.',
    'github-issue': 'Summarize this issue: the problem, current status, and relevance to the vault research.',
    'github-repo': 'Describe this project: purpose, tech stack, and relevance to the vault research.',
    'github-code': 'Analyze this code: what it does, key patterns, and connection to vault notes.',
    'ai-chat': 'Summarize the key points from this AI conversation and their relevance to the vault.',
    'paper': 'Summarize this paper: key contribution, methodology, and connection to vault research.',
    'docs': 'Extract the key technical details and their relevance to vault research.',
    'generic': 'Analyze this page: what it\'s about and how it connects to the vault research.',
  };

  return `${systemPreamble}
Page (${p.pageType}): ${p.url}
Content:
${p.cleanedContext.substring(0, 1200)}

${p.vaultContext ? `Vault notes:\n${p.vaultContext.substring(0, 800)}\n` : ''}
Task: ${typeInstructions[p.pageType] || typeInstructions.generic}
Brain:`;
}

/** Strip <think> tags, clean repetition, trim whitespace */
function postProcessResponse(raw: string): string {
  let text = raw;

  // Strip qwen3 thinking tags
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  text = text.replace(/<\/?think>/g, '');

  // Remove common LLM artifacts
  text = text.replace(/^(Brain|Assistant|AI):\s*/i, '');
  text = text.replace(/\*\*/g, '');  // Remove bold markdown
  text = text.replace(/^[-•]\s+/gm, ''); // Remove bullet points

  // Collapse repeated sentences
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const s of sentences) {
    const normalized = s.toLowerCase().trim();
    if (normalized.length > 10 && seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(s);
  }
  text = deduped.join(' ');

  // Clean whitespace
  text = text.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  return text;
}

// ---------------------------------------------------------------------------
// Tool: process_browser_context
// ---------------------------------------------------------------------------
server.tool(
  'process_browser_context',
  'Process scraped browser DOM context and return a dynamic UI payload. Supports follow-up chat via the question param.',
  {
    url: z.string().describe('The URL of the page being scraped'),
    context: z.string().describe('The raw text content of the DOM'),
    question: z.string().optional().describe('Optional follow-up question from the user'),
    history: z.string().optional().describe('Optional JSON array of previous chat messages [{role,content}]'),
    model: z.string().optional().describe('Ollama model name to use (default: qwen3:0.6b)'),
  },
  async ({ url, context, question, history, model }) => {
    const ollamaModel = model || 'qwen3:0.6b';
    const startTime = Date.now();
    const isChat = !!question;
    console.log(`[Brain] ${isChat ? 'CHAT' : 'ANALYZE'}: ${isChat ? question : `${context.length} chars from ${url}`}`);

    // -----------------------------------------------------------------------
    // 1. PAGE TYPE DETECTION + SMART CONTEXT EXTRACTION
    // -----------------------------------------------------------------------
    const pageType = detectPageType(url);
    const cleanedContext = extractSmartContext(url, context, pageType);
    console.log(`[Brain] Page type: ${pageType}, cleaned context: ${cleanedContext.length} chars`);

    // -----------------------------------------------------------------------
    // 2. VAULT SEARCH — TF-IDF weighted with relevant snippet extraction
    // -----------------------------------------------------------------------
    const vaultRoot = '/Users/ahmetbarisgunaydin2/Documents/research-vault';
    let vaultContext = '';
    let vaultStatus = '❌ Not Found';
    let vaultFiles: string[] = [];

    try {
      const searchText = isChat
        ? `${question} ${cleanedContext.substring(0, 300)}`
        : cleanedContext;

      const searchResult = searchVault(vaultRoot, searchText, 5);
      vaultFiles = searchResult.files;
      vaultContext = searchResult.context;
      vaultStatus = searchResult.status;
      console.log(`[Brain] Vault: ${vaultStatus}`);
    } catch (e) {
      console.log(`[Brain] Vault search failed:`, (e as Error).message);
    }

    // -----------------------------------------------------------------------
    // 3. LLM QUERY — with optimized prompting
    // -----------------------------------------------------------------------
    let llmResponse = '';
    let llmStatus = 'Skipped';
    let inferenceMs = 0;

    try {
      const prompt = buildPrompt({
        pageType, url, cleanedContext, vaultContext,
        isChat, question: question || '', history: history || '',
      });

      console.log(`[Brain] Prompt: ${prompt.length} chars, querying ${ollamaModel}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: true,
          options: {
            num_predict: 300,
            temperature: 0.4,
            top_p: 0.9,
            repeat_penalty: 1.15,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Stream NDJSON tokens from Ollama
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      let promptTokens = 0;
      let completionTokens = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              if (chunk.response) {
                accumulated += chunk.response;
                // Send streaming token via MCP logging notification
                try {
                  server.sendLoggingMessage({
                    level: 'info',
                    data: JSON.stringify({ type: 'stream_token', token: chunk.response }),
                  });
                } catch { /* client may not be listening yet */ }
              }
              if (chunk.done && chunk.eval_duration) {
                inferenceMs = Math.round(chunk.eval_duration / 1e6);
              }
              if (chunk.prompt_eval_count) promptTokens = chunk.prompt_eval_count;
              if (chunk.eval_count) completionTokens = chunk.eval_count;
            } catch { /* skip malformed lines */ }
          }
        }
      }

      llmResponse = postProcessResponse(accumulated);
      // Signal stream end
      try {
        server.sendLoggingMessage({
          level: 'info',
          data: JSON.stringify({ type: 'stream_end', promptTokens, completionTokens, inferenceMs }),
        });
      } catch { /* ok */ }

      const inferenceS = (inferenceMs / 1000).toFixed(1);
      llmStatus = `✅ ${llmResponse.length} chars in ${inferenceS}s`;
      console.log(`[Brain] LLM: ${llmResponse.substring(0, 200)}`);
    } catch (e: any) {
      console.log(`[Brain] Ollama error: ${e.message}`);
      llmStatus = `⚠️ ${e.name === 'AbortError' ? 'Timeout (30s)' : e.message}`;
    }

    // -----------------------------------------------------------------------
    // 4. BUILD UI PAYLOAD
    // -----------------------------------------------------------------------
    const totalMs = Date.now() - startTime;

    const analysisContent = llmResponse
      ? `<p style="color: #e5e7eb; font-size: 14px; line-height: 1.7; margin: 0;">${llmResponse}</p>`
      : `<p style="color: #9ca3af; font-size: 13px;">LLM unavailable. Pipeline status below.</p>`;

    const vaultFilesHtml = vaultFiles.length > 0
      ? vaultFiles.map(f => `<span style="display:inline-block; background:rgba(167,139,250,0.12); color:#c4b5fd; padding:2px 8px; border-radius:4px; font-size:11px; margin:2px 4px 2px 0;">📄 ${f}</span>`).join('')
      : '<span style="color:#6b7280; font-size:11px;">No vault matches</span>';

    const uiPayload = `
      <div style="font-family: -apple-system, system-ui, sans-serif;">
        ${analysisContent}

        <div style="margin-top: 12px;">
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Vault context:</div>
          <div style="display: flex; flex-wrap: wrap;">${vaultFilesHtml}</div>
        </div>

        <div style="margin-top: 10px; padding: 8px 10px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; font-size: 11px; color: #4b5563; display: flex; gap: 12px; flex-wrap: wrap;">
          <span>${pageType}</span>
          <span>${context.length}→${cleanedContext.length} chars</span>
          <span>${vaultFiles.length} vault files</span>
          <span>${(totalMs / 1000).toFixed(1)}s total</span>
        </div>
      </div>
    `;

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ uiPayload }) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  if (useWebRtc) {
    if (!webrtcRoom) {
      // Generate a random room ID if not provided
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      webrtcRoom = 'mkv-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    console.error(`Starting MarkView MCP server in WebRTC mode`);
    console.error(`Signaling server: ${signalingUrl}`);
    console.error(`Room ID: ${webrtcRoom}`);
    console.error(`Waiting for remote AI agents to connect...`);
    
    const transport = new WebRTCServerTransport(webrtcRoom, signalingUrl);
    await server.connect(transport);
    console.error(`markview-mcp WebRTC server running on ${resolvedDir} — 29 tools, 1 resource, 3 prompts available`);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`markview-mcp stdio server running on ${resolvedDir} — 28 tools, 1 resource, 3 prompts available`);
  }
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
