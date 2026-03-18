# @markview/webcomponent

Web Component for beautiful markdown rendering — works with Vue, Angular, Svelte, or plain HTML.

[![npm](https://img.shields.io/npm/v/@markview/webcomponent)](https://www.npmjs.com/package/@markview/webcomponent)
[![license](https://img.shields.io/npm/l/@markview/webcomponent)](https://github.com/abgnydn/markview/blob/main/LICENSE)

## Install

```bash
npm install @markview/webcomponent
```

**Optional peer dependencies:**

```bash
npm install shiki      # syntax highlighting
npm install mermaid    # diagrams
npm install katex      # math equations
```

## Quick Start

### Plain HTML

```html
<script type="module">
  import '@markview/webcomponent';
</script>

<mark-view
  content="# Hello World\n\nThis is **markdown**."
  theme="dark"
  shiki
  mermaid
  katex
></mark-view>
```

### Vue

```vue
<template>
  <mark-view :content="markdown" theme="dark" shiki mermaid katex />
</template>

<script setup>
import '@markview/webcomponent';
const markdown = ref('# Hello from Vue');
</script>
```

### Angular

```typescript
// app.module.ts
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import '@markview/webcomponent';

@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
```

```html
<mark-view [attr.content]="markdown" theme="dark" shiki mermaid></mark-view>
```

### Svelte

```svelte
<script>
  import '@markview/webcomponent';
  let markdown = '# Hello from Svelte';
</script>

<mark-view content={markdown} theme="dark" shiki mermaid katex />
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `content` | `string` | `''` | Markdown content |
| `theme` | `'dark'\|'light'\|'auto'` | `'auto'` | Color theme |
| `shiki` | `boolean` | — | Enable syntax highlighting |
| `mermaid` | `boolean` | — | Enable diagrams |
| `katex` | `boolean` | — | Enable math equations |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `headings-change` | `TocHeading[]` | Fired when headings are extracted |
| `render-complete` | `string` | Fired with the rendered HTML |

```javascript
document.querySelector('mark-view')
  .addEventListener('headings-change', (e) => {
    console.log('TOC:', e.detail);
  });
```

## JavaScript API

```javascript
const el = document.querySelector('mark-view');

// Set content programmatically
el.content = '# Updated content';
el.theme = 'light';
```

## License

AGPL-3.0 — [Commercial licenses available](https://github.com/abgnydn/markview/blob/main/COMMERCIAL_LICENSE.md)
