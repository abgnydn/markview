/**
 * @markview/core — Beautiful, framework-agnostic markdown renderer
 *
 * Render GitHub-flavored markdown to HTML with optional Shiki syntax highlighting,
 * Mermaid diagrams, and KaTeX math support. Zero framework dependencies.
 *
 * @example
 * ```ts
 * import { renderMarkdown } from '@markview/core';
 *
 * const html = await renderMarkdown('# Hello World', {
 *   shiki: true,
 *   mermaid: true,
 *   katex: true,
 * });
 * ```
 *
 * @packageDocumentation
 */

export { renderMarkdown, type RenderOptions } from './pipeline.js';
export { parseFrontmatter, type FrontmatterResult } from './frontmatter.js';
export { extractHeadings, type TocHeading } from './headings.js';
export { searchFiles, type SearchResult } from './search.js';
