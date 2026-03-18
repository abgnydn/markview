# @markview/react

Drop-in React component for beautiful markdown rendering.

[![npm](https://img.shields.io/npm/v/@markview/react)](https://www.npmjs.com/package/@markview/react)
[![license](https://img.shields.io/npm/l/@markview/react)](https://github.com/abgnydn/markview/blob/main/LICENSE)

## Install

```bash
npm install @markview/react @markview/core
```

**Optional peer dependencies** (install what you need):

```bash
npm install shiki      # syntax highlighting
npm install mermaid    # diagrams
npm install katex      # math equations
```

## Quick Start

```tsx
import { MarkView } from '@markview/react';
import '@markview/core/styles';

function Docs({ markdown }: { markdown: string }) {
  return <MarkView content={markdown} theme="dark" shiki mermaid katex />;
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | **required** | Markdown content to render |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'auto'` | Color theme |
| `shiki` | `boolean` | `false` | Enable syntax highlighting |
| `mermaid` | `boolean` | `false` | Enable diagram rendering |
| `katex` | `boolean` | `false` | Enable math equations |
| `className` | `string` | — | Container CSS class |
| `style` | `CSSProperties` | — | Container inline styles |
| `onHeadingsChange` | `(headings) => void` | — | TOC heading callback |
| `onHtmlRendered` | `(html) => void` | — | Raw HTML callback |
| `onNavigateToFile` | `(filename) => void` | — | Internal link click handler |
| `workspaceFiles` | `string[]` | — | Filenames for link validation |

## Features

- 🎨 **Shiki syntax highlighting** — 140+ languages, GitHub themes
- 📊 **Mermaid diagrams** — flowcharts, sequence, gantt, etc.
- 📐 **KaTeX math** — inline and block equations
- 📋 **Code copy** — one-click copy with visual feedback
- 🔗 **Link validation** — broken internal link detection
- 🔍 **Diagram zoom** — fullscreen preview with scroll-to-zoom
- 📊 **Table sorting** — click column headers to sort
- 🛡️ **XSS sanitization** — built-in via rehype-sanitize
- 🎯 **GitHub-style alerts** — NOTE, TIP, WARNING, CAUTION

## Theming

Import the base styles from `@markview/core`:

```tsx
import '@markview/core/styles';
```

Customize with CSS custom properties (prefixed `--mv-*`):

```css
.my-docs {
  --mv-bg: #1a1a2e;
  --mv-text: #e4e4e7;
  --mv-link: #818cf8;
  --mv-code-bg: #16162a;
}
```

## Preloading

For faster first render, preload Shiki on app mount:

```tsx
import { preloadShiki } from '@markview/react';

// In your app's entry point
preloadShiki();
```

## License

AGPL-3.0 — [Commercial licenses available](https://github.com/abgnydn/markview/blob/main/COMMERCIAL_LICENSE.md)
