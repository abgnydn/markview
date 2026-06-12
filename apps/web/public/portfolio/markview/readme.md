<div align="center">

# MarkView

**A local-first markdown editor that reads like a painting.**

Write, render, and share GitHub-flavored markdown entirely on your machine — then drop into an *atmosphere*: a public-domain painting behind the page and an antique paper scroll to read on. Web app + native desktop. Zero accounts, zero cloud, zero telemetry.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-6366f1.svg)](LICENSE)
[![Deploy](https://github.com/abgnydn/markview/actions/workflows/deploy.yml/badge.svg)](https://github.com/abgnydn/markview/actions/workflows/deploy.yml)
[![Desktop](https://img.shields.io/badge/Desktop-macOS_·_Windows_·_Linux-111)](https://github.com/abgnydn/markview/releases)
[![Live Demo](https://img.shields.io/badge/Live_Demo-▶-ff6b6b)](https://markview.ai)

<br />

<img src=".github/assets/hero.png" alt="MarkView" width="800" />

</div>

---

## What MarkView is

A single app — running in your browser or as a native desktop window — that
handles the full life of a markdown document **without anything leaving your
machine**. It renders GitHub-flavored markdown with Mermaid, KaTeX, and Shiki;
edits in a CodeMirror 6 surface; searches, exports, and shares; and wraps the
whole thing in an optional, gorgeous **atmosphere** reading mode.

- **Local-first** — documents live in your browser's IndexedDB, on-device.
- **Two surfaces, one codebase** — the web app and a Tauri desktop mirror of it.
- **Private by default** — no accounts, no telemetry. The only outbound
  features are opt-in: peer-to-peer collaboration and explicit share links.

Try it at **[markview.ai](https://markview.ai)** — no install — or grab a
[desktop build](https://github.com/abgnydn/markview/releases).

---

## ✨ The atmosphere

The headline feature. Toggle an atmosphere and the page changes character: a
public-domain masterwork settles behind your text, and the reading column
becomes a stained, fibred, antique paper scroll with a vermillion drop-cap and
classical serifs.

| Pack | Behind the page | Particles |
|---|---|---|
| **Fuji** | Hokusai's Mount Fuji series (8 prints) | drifting petals |
| **Wave** | Great Wave + seascapes (7 works) | sea spray |
| **Snow** | Hiroshige snow scenes (9 works) | falling snow |
| **Fields** | Van Gogh, Bruegel, Ruisdael (6 works) | floating motes |

All 30 paintings are **CC0** from The Met's Open Access program, and they
rotate on a tempo you choose (every visit, hourly, daily, or pinned).

- **Ambient life** — cranes, koi, butterflies, and crows drift through the
  scene, matched to the active pack.
- **Enter the painting** — press a key and a depth map (ML when available, a
  fast procedural fallback otherwise) turns the artwork into a Gaussian-splat
  point cloud you can move through in 3D, with your documents floating as
  aged-parchment cards.
- **Per-pack theming** — each atmosphere carries its own ink palette and paper
  tone, so the whole UI shifts mood with the art.

---

## 📝 Editor features

| | |
|---|---|
| **Rendering** | GitHub-flavored markdown, Mermaid diagrams, KaTeX math, Shiki syntax highlighting (140+ languages), tables, alerts, footnotes |
| **Editing** | CodeMirror 6 surface, WYSIWYG-style toolbar, split view, focus mode, vanishing chrome (hover an edge to reveal toolbar / sidebar / TOC) |
| **Workspace** | Multi-file trees, IndexedDB persistence, drag-and-drop, GitHub repo import, full-text search |
| **Related notes** | On-device semantic search — `all-MiniLM-L6-v2` runs locally (WebGPU/WASM) to surface notes you forgot you wrote. Nothing is uploaded. |
| **Collaboration** | Real-time multi-user editing over WebRTC (Yjs) — document data goes peer-to-peer, never through a server |
| **Export** | PDF, Word, PowerPoint, PNG, SVG, HTML, Markdown, RST, AsciiDoc, static site |
| **Themes** | 6 curated presets — GitHub, Dracula, Nord, Monokai, Solarized, Rosé Pine — plus light/dark and atmospheres |
| **Sharing** | One-click public share links (rendered read-only by a Cloudflare Worker) |
| **Privacy** | Zero accounts, zero cloud, zero telemetry. Works offline. |

---

## 🚀 Quick start

```bash
bun install        # from the repo root — installs every workspace
bun run dev        # web app at http://localhost:3001
```

Native desktop (needs a Rust toolchain + Tauri prerequisites):

```bash
bun run dev:desktop    # builds the web frontend + launches the Tauri window
```

---

## 🏗️ Architecture

MarkView is **one product — a markdown editor — shipped as a web app and a
native desktop mirror of it.**

```
markview/
├── apps/
│   ├── web/            # Vite + React 19 SPA — the editor (static export)
│   ├── desktop/        # Tauri 2 shell wrapping the web build
│   └── share-worker/   # Cloudflare Worker — share renderer + Yjs signaling
├── packages/
│   └── core/           # @markview/core — framework-agnostic markdown engine
└── README.md
```

| Workspace | Tech | Description |
|---|---|---|
| **web** | Vite, React 19, React Router, CodeMirror 6, three.js, Zustand, Shiki, Mermaid, KaTeX | The editor + atmosphere system + 3D world |
| **desktop** | Tauri 2, Rust, system WebView | Native app — macOS (arm64/x64), Windows (x64), Linux (x64) |
| **share-worker** | Cloudflare Workers, R2, KV, Durable Objects | Public read-only share pages + WebRTC signaling |
| **core** | TypeScript, remark / rehype | The markdown pipeline (sanitized, framework-agnostic) |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full map.

> **Earlier monorepo:** MarkView once bundled an MCP server, a hub, Chrome
> extensions, and a 3D vault/brain. Those were split into their own repos —
> this one is web + desktop.

---

## 🐳 Self-hosting

The web app is a static export — host it anywhere.

```bash
bun --filter @markview/web build   # output → apps/web/out/
```

Serve `apps/web/out/` from any static host (Cloudflare Pages, Netlify, S3, nginx).
Public share links require deploying `apps/share-worker` to Cloudflare.

---

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Fork, branch, run the
checks, open a PR.

---

## 📄 License

[Apache-2.0](LICENSE) © [Ahmet Barış Günaydın](https://github.com/abgnydn)

---

<div align="center">

**⭐ Star this repo if you find it useful.**

Built with Vite, React, Tauri, three.js, Shiki, Mermaid, and KaTeX.

</div>
