<div align="center">

# @markview/core

**Beautiful, framework-agnostic markdown renderer**

Render GitHub-flavored markdown to HTML with optional Shiki syntax highlighting, Mermaid diagrams, and KaTeX math. Zero framework dependencies.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-6366f1.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@markview/core)](https://www.npmjs.com/package/@markview/core)

</div>

---

## Install

```bash
npm install @markview/core
```

Optional peer dependencies (install only what you need):

```bash
npm install shiki      # Syntax highlighting (140+ languages)
npm install mermaid    # Diagram rendering
npm install katex      # Math equations
```

## Quick Start

```typescript
import { renderMarkdown } from '@markview/core';
import '@markview/core/styles';

const html = await renderMarkdown('# Hello World\n\nThis is **bold** and `inline code`.', {
  shiki: true,
  mermaid: true,
  katex: true,
});

document.getElementById('content').innerHTML = `<div class="markview-content">${html}</div>`;
```

## API

### `renderMarkdown(content, options?)`

Render markdown to HTML with full GFM support.

```typescript
const html = await renderMarkdown(content, {
  shiki: true,                          // Enable syntax highlighting
  shiki: { theme: 'github-dark' },      // Custom Shiki theme
  mermaid: true,                        // Enable Mermaid diagrams
  mermaid: { theme: 'dark' },           // Custom Mermaid theme
  katex: true,                          // Enable KaTeX math
  sanitize: true,                       // HTML sanitization (default: true)
  headingIds: true,                     // Auto-generate heading IDs (default: true)
  alerts: true,                         // GitHub-style alerts (default: true)
  codeBlockToolbar: true,               // Code block copy button (default: true)
});
```

### `parseFrontmatter(raw)`

Parse YAML frontmatter from markdown.

```typescript
import { parseFrontmatter } from '@markview/core';

const { data, content } = parseFrontmatter(`---
title: My Document
tags: [typescript, markdown]
---
# Hello`);

console.log(data.title);  // "My Document"
console.log(data.tags);   // ["typescript", "markdown"]
```

### `extractHeadings(html)`

Extract headings from rendered HTML for table of contents.

```typescript
import { renderMarkdown, extractHeadings } from '@markview/core';

const html = await renderMarkdown('# Title\n## Section');
const headings = extractHeadings(html);
// [{ id: 'title', text: 'Title', level: 1 }, { id: 'section', text: 'Section', level: 2 }]
```

### `searchFiles(files, query)`

Full-text search across markdown files.

```typescript
import { searchFiles } from '@markview/core';

const results = searchFiles([
  { id: '1', filename: 'README.md', content: '# Hello\nWorld' },
], 'hello');
```

## Styling

Import the included styles and wrap your HTML in a `.markview-content` container:

```html
<div class="markview-content">
  <!-- rendered HTML goes here -->
</div>
```

### Theming

Override CSS custom properties to match your design:

```css
:root {
  --mv-text-primary: #1f2328;
  --mv-bg-primary: #ffffff;
  --mv-accent-blue: #0969da;
  /* ... see styles/markview.css for all tokens */
}
```

## License

AGPL-3.0 — see [LICENSE](../../LICENSE).

For commercial use without AGPL obligations, contact [abgunaydin94@gmail.com](mailto:abgunaydin94@gmail.com) for a commercial license.
