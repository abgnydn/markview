<div align="center">

# MarkView

**A local-first knowledge stack for the AI age.**

**Markdown that becomes a living vault. A 3D brain that watches your AI sessions. An MCP bridge so any AI tool can read and edit your knowledge — without anything ever leaving your machine.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-6366f1.svg)](LICENSE)
[![mcp](https://img.shields.io/npm/v/@markview/mcp?color=10b981&label=%40markview%2Fmcp)](https://www.npmjs.com/package/@markview/mcp)
[![CI](https://github.com/abgnydn/markview/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/markview/actions/workflows/ci.yml)
[![MCP Tools](https://img.shields.io/badge/MCP_Tools-23-10b981)](apps/mcp)
[![Made with Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Live Demo](https://img.shields.io/badge/Live_Demo-▶-ff6b6b)](https://markview.ai)

<br />

<img src=".github/assets/hero.png" alt="MarkView" width="800" />

</div>

---

## What MarkView is

A single web app that handles the full lifecycle of your local knowledge:

- **`/`** — the editor. Create, edit, render, and share markdown. GitHub-flavored, Mermaid, KaTeX, Shiki, presentations, exports, themes, plugins, P2P collab via WebRTC.
- **`/vault`** — your knowledge graph in 3D. Drop documents in, watch them orbit. Wikilinks become real edges. TF-IDF + multilingual embeddings find related notes you forgot you wrote. Press a key to expand into a full graph view.
- **`/brain`** — live view of every AI session writing into your local vault. See active Claude/Cursor/Continue sessions, the tools they're calling, the cost they're burning, in a 3D kanban orbit.
- **The Chrome extensions** (`apps/extension`, `apps/context-injector`) — a side-panel markdown viewer and a WebRTC bridge that connects ChatGPT/Claude.ai tabs to your local files. Zero uploads.
- **The MCP server** (`@markview/mcp`) — exposes 23 tools so Claude Desktop, Cursor, Zed, or any MCP-compatible client can read, search, and edit your vault directly inside their conversations.
- **The desktop shell** (`apps/desktop`) — a Tauri wrapper for users who want MarkView as a standalone app instead of a browser tab.

**The promise:** zero accounts, zero cloud, zero telemetry. Your knowledge stays on your laptop. AI tools talk to it through MCP. Browsers connect to it through a P2P bridge. Nothing uploads.

---

## 🚀 Quick start

```bash
# 1. Web app + editor (port 3000)
cd apps/web && npm install && npm run dev

# 2. (Optional) MCP server for AI tools
cd apps/mcp && npm install && npm run build

# 3. (Optional) Chrome extensions — load apps/extension and
#    apps/context-injector as unpacked extensions in chrome://extensions
```

Open [http://localhost:3000](http://localhost:3000) — drop some markdown files into `/vault` to see them orbit. Or just hit the **[live demo](https://markview.ai)** — no install needed.

### MCP — the SDK

The MCP server lets any AI assistant read, search, and edit your vault. Add it to your tool of choice:

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "markview": {
      "command": "npx",
      "args": ["-y", "@markview/mcp", "/path/to/your/vault"]
    }
  }
}
```

Restart Claude Desktop. You'll see "markview" in the MCP tools menu (🔧).

</details>

<details>
<summary><strong>Cursor</strong></summary>

**Settings → MCP Servers → Add Server**:

```json
{
  "command": "npx",
  "args": ["-y", "@markview/mcp", "/path/to/your/vault"]
}
```

</details>

<details>
<summary><strong>Any MCP-compatible client</strong></summary>

```json
{
  "mcpServers": {
    "markview": {
      "command": "npx",
      "args": ["-y", "@markview/mcp", "/path/to/your/vault"]
    }
  }
}
```

</details>

**What you can ask your AI:**

> *"Search my vault for authentication setup"*
> *"What are the headings in API.md?"*
> *"Find all broken links across my notes"*
> *"Create a new doc called getting-started.md with an intro section"*
> *"Summarize my notes from last week tagged #ideas"*

---

## 🤖 MCP tools (23)

| Category | Tools |
|----------|-------|
| **Read & analyze** | `list_documents` `get_document` `search_docs` `get_headings` `get_links` `get_code_blocks` `get_frontmatter` `get_tables` `get_related_docs` `get_glossary` `get_mermaid_diagrams` `get_math_blocks` `analyze_reading_level` |
| **Graph queries** | `get_related_within_hops` `get_shortest_path` `get_ego_graph` `get_vault_hubs` `get_communities` |
| **Workspace health** | `validate_workspace` `get_stats` `generate_toc` |
| **Write & manage** | `create_document` `update_document` `rename_document` `delete_document` `merge_documents` |
| **Share & export** | `share_document` `render_document` |

See [apps/mcp/README.md](apps/mcp/README.md) for full documentation.

---

## 🌐 WebRTC context bridge

Stream your local vault context to any browser-based AI tool via a peer-to-peer WebRTC data channel — **zero cloud, zero uploads, zero trust required**.

```
┌─────────────────┐     WebRTC DataChannel     ┌──────────────────────┐
│  Browser Agent  │◄──────────────────────────►│  Local MCP Server    │
│  (/agent page)  │   Encrypted P2P tunnel     │  (your terminal)     │
└─────────────────┘                            └──────────────────────┘
```

```bash
# 1. Start the signaling relay
npx tsx apps/mcp/scripts/signaling-server.ts

# 2. Launch MCP in WebRTC mode
npx markview-mcp ./vault --webrtc --room my-room

# 3. Open the Agent Bridge in your browser
#    → http://localhost:3000/agent
```

Once connected, the browser has direct read/execute access to all 23 MCP tools running on your local machine. No files ever leave your device.

| Property | Detail |
|---|---|
| Transport | RTCPeerConnection + RTCDataChannel |
| Signaling | Lightweight WebSocket relay (localhost) |
| Encryption | DTLS 1.2 (built into WebRTC) |
| Latency | Sub-millisecond on localhost |
| Dependencies | Zero — uses browser-native WebRTC APIs |

---

## ✨ Editor features

| | |
|---|---|
| **Rendering** | GitHub-flavored markdown, Mermaid diagrams, KaTeX math, Shiki syntax highlighting (140+ languages), tables, alerts, footnotes |
| **Workspace** | Multi-tab, nested file trees, IndexedDB persistence, drag-and-drop, GitHub repo import, URL sharing (gzip + base64url), P2P real-time collaboration |
| **Productivity** | Full-text search (⌘K), split view, diff view, WYSIWYG editor with formatting toolbar, presentation mode, focus mode, version history, annotations |
| **Export** | PDF, Word, PowerPoint, PNG, SVG, HTML, RST, AsciiDoc, static site, print |
| **Themes** | 6 curated presets — GitHub, Dracula, Nord, Monokai, Solarized, Rosé Pine |
| **Extensibility** | Plugin system for custom code-fence renderers (alert, chart, tabs, timeline). YouTube / Figma / CodePen / CodeSandbox / Loom embeds via ` ```embed ` |
| **Privacy** | Zero accounts, zero cloud, zero telemetry. Full PWA, works offline. |

---

## 🏗️ Architecture

```
markview/
├── apps/
│   ├── web/          # Next.js 16 — editor, /vault, /brain
│   ├── hub/          # Hono server (port 3100) — local data bridge
│   ├── mcp/          # MCP server — the SDK
│   ├── desktop/      # Native macOS app (Tauri v2)
│   └── extension/    # Chrome extension for inline .md viewing
├── packages/
│   └── core/         # Internal markdown engine
└── README.md
```

| App | Tech | Description |
|---|---|---|
| **web** | Next.js 16, React, three.js, Zustand, Shiki, Mermaid, KaTeX | The editor + 3D vault + brain |
| **hub** | Hono, @hono/node-server | Local server: serves vault docs, watches AI sessions, MCP relay |
| **mcp** | TypeScript, @modelcontextprotocol/sdk | The 23-tool MCP server |
| **desktop** | Tauri v2, Rust, WebKit | Native macOS app with file associations |
| **extension** | Chrome Extensions API | View `.md` files inside the browser |

---

## 🐳 Self-hosting

MarkView's web app ships as a static export — host it anywhere.

```bash
# Docker Compose (quickest)
cp apps/web/.env.example .env
docker compose up --build -d
# → http://localhost:3000

# Manual Docker
docker build -f apps/web/Dockerfile -t markview .
docker run -p 3000:3000 markview
```

For `/brain` and `/vault` to show live data from a local-running session fleet, point them at a hub server (e.g. [github.com/abgnydn/hub](https://github.com/abgnydn/hub)) on `:3100` — configure via `NEXT_PUBLIC_BRAIN_HUB_URL`.

---

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Fork, branch, commit, push, open a PR.

---

## 📄 License

[AGPL-3.0](LICENSE) © [Ahmet Barış Günaydın](https://github.com/abgnydn)

---

<div align="center">

**⭐ Star this repo if you find it useful.**

Built with Next.js, three.js, Shiki, Mermaid, KaTeX, MCP, and a private bridge.

</div>
