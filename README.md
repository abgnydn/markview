<div align="center">

# MarkView

**The markdown viewer your docs deserve.**

Beautiful rendering, full-text search, split view, presentation mode, built-in editor, and 15 MCP tools for AI assistants. Your files never leave the browser.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-6366f1.svg)](LICENSE)
[![core](https://img.shields.io/npm/v/@markview/core?color=cc3534&label=%40markview%2Fcore)](https://www.npmjs.com/package/@markview/core)
[![react](https://img.shields.io/npm/v/@markview/react?color=61dafb&label=%40markview%2Freact)](https://www.npmjs.com/package/@markview/react)
[![webcomponent](https://img.shields.io/npm/v/@markview/webcomponent?color=f7df1e&label=%40markview%2Fwebcomponent)](https://www.npmjs.com/package/@markview/webcomponent)
[![mcp](https://img.shields.io/npm/v/@markview/mcp?color=10b981&label=%40markview%2Fmcp)](https://www.npmjs.com/package/@markview/mcp)
[![CI](https://github.com/abgnydn/markview/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/markview/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-66_passing-22c55e)](apps/web/src/__tests__)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Made with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![MCP Tools](https://img.shields.io/badge/MCP_Tools-15-10b981)](apps/mcp)
[![Live Demo](https://img.shields.io/badge/Live_Demo-▶-ff6b6b)](https://getmarkview.vercel.app)

<br />

<img src=".github/assets/hero.png" alt="MarkView" width="800" />

</div>

---

## ✨ Features

### Rendering & Viewing
- 📝 **GitHub-flavored markdown** with full spec support
- 🧜 **Mermaid diagrams** rendered inline
- 🔢 **KaTeX math** — inline and block equations
- 🎨 **Syntax highlighting** via Shiki (140+ languages)
- 📊 **Tables, alerts, footnotes** — all GitHub extensions

### Workspace Management
- 📂 **Multi-tab workspaces** with nested file trees
- 💾 **Persistent sessions** via IndexedDB (survives refresh)
- 🔗 **Inter-document linking** — click links between docs
- 📎 **Drag & drop** file upload or open folders
- 🐙 **GitHub import** — paste a repo URL, instantly load docs

### Productivity
- 🔍 **Full-text search** across all documents (⌘K)
- ↔️ **Split view** — compare two files side by side
- 📊 **Diff view** — unified diff with line-by-line highlighting
- ✏️ **Built-in editor** — edit, split, and preview modes
- 🎬 **Presentation mode** — transform headings into slides
- 🧘 **Focus mode** — distraction-free reading
- ⌨️ **Keyboard-first** — navigate files, switch workspaces, adjust font size
- 📋 **Export everywhere** — PDF, Word, PowerPoint, PNG, SVG, HTML, RST, AsciiDoc, static site, or print

### Privacy & Offline
- 🔒 **Zero accounts** — no sign-up required
- ☁️ **Zero cloud** — files never leave the browser
- 📡 **Zero telemetry** — no tracking, no analytics
- ✈️ **Works offline** — full PWA support

---

## 🚀 Quick Start

### Web App

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — drop some markdown files and go.

Or use the **[live demo](https://getmarkview.vercel.app)** — no install needed.

### Install as PWA (Desktop App)

MarkView works as a Progressive Web App — install it for an app-like experience with offline support:

1. Open the web app in Chrome/Edge
2. Click the **install icon** (⊕) in the address bar
3. Click **"Install"**

That's it — MarkView now runs as a standalone desktop app, works offline, and persists your workspaces.

### Chrome Extension

Load `apps/extension` as an unpacked extension in Chrome to view `.md` files directly in the browser.

### MCP Server

The MCP server lets AI assistants read, search, and manage your markdown documentation. First, build it:

```bash
cd apps/mcp
npm install
npm run build
```

Then add it to your AI tool:

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "markview": {
      "command": "node",
      "args": ["/absolute/path/to/markview/apps/mcp/dist/index.js", "/path/to/your/docs"]
    }
  }
}
```

Restart Claude Desktop. You'll see "markview" in the MCP tools menu (🔧).

</details>

<details>
<summary><strong>Cursor</strong></summary>

Go to **Settings → MCP Servers → Add Server** and use:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/markview/apps/mcp/dist/index.js", "/path/to/your/docs"]
}
```

</details>

<details>
<summary><strong>Any MCP-compatible client</strong></summary>

```json
{
  "mcpServers": {
    "markview": {
      "command": "node",
      "args": ["path/to/markview/apps/mcp/dist/index.js", "./your-docs"]
    }
  }
}
```

</details>

**What you can ask your AI:**

> *"Search my docs for authentication setup"*
> *"What are the headings in API.md?"*
> *"Find all broken links in my documentation"*
> *"Create a new doc called getting-started.md with an intro section"*
> *"Show me all code examples in Python across my docs"*

---

## 🤖 MCP Tools (15)

The Model Context Protocol server lets AI assistants interact with your documentation workspace:

| Category | Tools |
|----------|-------|
| **Read & Analyze** | `list_documents` `get_document` `search_docs` `get_headings` `get_links` `get_code_blocks` `get_frontmatter` `get_tables` `get_related_docs` `get_glossary` |
| **Workspace Health** | `validate_workspace` `get_stats` |
| **Write & Manage** | `create_document` `update_document` `rename_document` |

See [apps/mcp/README.md](apps/mcp/README.md) for full documentation.

---

## 🏗️ Architecture

```
markview/
├── apps/
│   ├── web/          # Next.js 16 documentation viewer
│   ├── mcp/          # MCP server (15 tools)
│   └── extension/    # Chrome extension
├── LICENSE           # AGPL-3.0
├── CONTRIBUTING.md
└── README.md
```

| App | Tech | Description |
|-----|------|-------------|
| **Web** | Next.js 16, React, Zustand, Shiki, Mermaid, KaTeX | Main documentation viewer |
| **MCP** | TypeScript, @modelcontextprotocol/sdk | AI documentation tools |
| **Extension** | Chrome Extensions API | View .md files in browser |

---

## 🗺️ Roadmap

MarkView is actively maintained. Here's what's coming:

| Status | Feature | Description |
|--------|---------|-------------|
| ✅ | Rich rendering | GFM, Mermaid, KaTeX, Shiki, alerts, tables |
| ✅ | Workspace management | Multi-tab, file trees, IndexedDB persistence |
| ✅ | Productivity suite | Search, split view, diff, editor, presentation, export |
| ✅ | MCP server | 15 AI documentation tools |
| ✅ | Chrome extension | View .md files in the browser |
| ✅ | PWA & offline | Install as desktop app, works without internet |
| ✅ | Import workspace ZIP | Load shared workspace archives |
| ✅ | Custom themes | 6 curated color schemes — Dracula, Monokai, Nord, Solarized, Rosé Pine |
| 🔜 | Plugin system | Extend rendering with custom blocks |
| ✅ | P2P collaboration | WebRTC-based workspace sharing — zero cloud |
| 🔮 | GitHub bi-directional sync | Pull & push docs to/from repos |
| ✅ | npm publish MCP | `npx markview-mcp ./docs` — [published!](https://www.npmjs.com/package/@markview/mcp) |
| 🔮 | VS Code extension | View docs without leaving the editor |

🔜 = planned &nbsp; 🔮 = exploring — [contributions welcome!](CONTRIBUTING.md)

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📦 Packages

MarkView is available as standalone npm packages:

| Package | Install | Use case |
|---------|---------|----------|
| [`@markview/core`](packages/core) | `npm i @markview/core` | Framework-agnostic rendering engine |
| [`@markview/react`](packages/react) | `npm i @markview/react` | Drop-in React component |
| [`@markview/webcomponent`](packages/webcomponent) | `npm i @markview/webcomponent` | Web Component for Vue, Angular, Svelte, plain HTML |
| [`@markview/mcp`](apps/mcp) | `npx markview-mcp ./docs` | MCP server — give AI assistants access to your docs |

**React:**
```tsx
import { MarkView } from '@markview/react';
import '@markview/core/styles';

<MarkView content={markdown} theme="dark" shiki mermaid katex />
```

**Any framework / plain HTML:**
```html
<script type="module">
  import '@markview/webcomponent';
</script>
<mark-view content="# Hello" theme="dark" shiki mermaid katex></mark-view>
```

**MCP for AI assistants:**
```bash
npx markview-mcp ./your-docs
```

See each package README for full API docs.

---

## 📄 License

[AGPL-3.0](LICENSE) © [Ahmet Barış Günaydın](https://github.com/abgnydn)

For commercial use without AGPL obligations, see [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md).

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Built with 💜 using Next.js, Shiki, Mermaid, KaTeX, and MCP

</div>
