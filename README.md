<div align="center">

# MarkView

**The markdown viewer your docs deserve.**

Beautiful rendering, full-text search, split view, presentation mode, built-in editor, and 15 MCP tools for AI assistants. Your files never leave the browser.

[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Made with Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![MCP Tools](https://img.shields.io/badge/MCP_Tools-15-10b981)](apps/mcp)

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
- 📋 **Export** — PDF, HTML, JSON, rich text, plain text, markdown bundle

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

### Chrome Extension

Load `apps/extension` as an unpacked extension in Chrome to view `.md` files directly in the browser.

### MCP Server

Connect your AI assistant (Claude, Cursor, etc.) to MarkView's documentation tools:

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
│   ├── web/          # Next.js 15 documentation viewer
│   ├── mcp/          # MCP server (15 tools)
│   └── extension/    # Chrome extension
├── LICENSE           # MIT
├── CONTRIBUTING.md
└── README.md
```

| App | Tech | Description |
|-----|------|-------------|
| **Web** | Next.js 15, React, Zustand, Shiki, Mermaid, KaTeX | Main documentation viewer |
| **MCP** | TypeScript, @modelcontextprotocol/sdk | AI documentation tools |
| **Extension** | Chrome Extensions API | View .md files in browser |

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

[MIT](LICENSE) © [Ahmet Barış Günaydın](https://github.com/abgnydn)

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Built with 💜 using Next.js, Shiki, Mermaid, KaTeX, and MCP

</div>
