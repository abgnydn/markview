# context-vault

> Give Claude Desktop, Cursor, ChatGPT, or any MCP-aware app **read-only** access to your local files — without uploading anything. Files stay on your machine; AI just reads them.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-30-47848f.svg)](https://www.electronjs.org/)
[![MCP](https://img.shields.io/badge/MCP-stdio-6e40c9.svg)](https://modelcontextprotocol.io/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-ff7043.svg)](https://webrtc.org/)

```
                 ┌──────────────────────────────────────┐
                 │           context-vault              │
                 │              (Electron)              │
                 │                                      │
                 │   ┌──────────────┐  ┌─────────────┐  │
                 │   │  Signaling   │  │  MCP Bridge │  │
                 │   │  Server      │  │  (WebRTC)   │  │
                 │   │  :4445       │  │             │  │
                 │   └──────────────┘  └─────────────┘  │
                 │                                      │
                 │   ┌──────────────┐  ┌─────────────┐  │
                 │   │  Access Log  │  │  Approval   │  │
                 │   │  (.json)     │  │  Gate       │  │
                 │   └──────────────┘  └─────────────┘  │
                 └──────────────────────────────────────┘
                          │                    │
                     WebSocket/P2P       stdio/MCP
                          │                    │
                   Browser AI            Claude Desktop
                   (extension)           Cursor, VS Code
```

## Why

Cloud AI tools want your files. Most of them upload everything to their servers. context-vault sits between them and your filesystem: it speaks the Model Context Protocol over stdio (for desktop tools) and WebRTC (for browser tabs), serves your files **read-only**, and logs every access. No bytes leave your machine.

## Features

- 🔒 **Read-only.** No file modifications, ever. The protocol surface doesn't expose write operations.
- 📄 **14 file formats** — Markdown, PDF, DOCX, TXT, JSON, CSV, XML, YAML, HTML, and more
- 🔗 **One-click integration** with Claude Desktop and Cursor (auto-writes the right MCP server config)
- 🛡️ **Approval gate** — sensitive paths (`.env`, `*.key`, `*secret*`) prompt for explicit consent before the first read
- 🚫 **Glob block-list** — `.env`, `.pem`, `.git/`, `node_modules/` blocked by default; extend with your own patterns
- 📊 **Privacy dashboard** — see which files were read, when, and how many times
- 📋 **Full audit log** — every access timestamped to a local JSON file you own
- 🚀 **Menu-bar tray** — runs silently on login

## Quick start

```bash
git clone https://github.com/abgnydn/context-vault.git
cd context-vault
npm install
npm start
```

1. Pick a folder when prompted
2. Click the tray icon → **Claude Desktop** to auto-configure (or **Cursor**)
3. Restart the AI app — it now has read-only access to that folder

## Build a release

```bash
npm run build          # macOS .dmg + .app
npm run build:win      # Windows .exe
npm run build:linux    # Linux .AppImage
```

Artifacts land in `dist/`. macOS builds are unsigned by default (`CSC_IDENTITY_AUTO_DISCOVERY=false`).

## Browser AI (ChatGPT, Claude.ai)

For browser tabs, context-vault runs a WebRTC signaling server on `:4445`. Pair with a Chrome extension that connects to it — the AI tab gets P2P access to your files without going through OpenAI/Anthropic's servers. See the companion repos.

## MCP tools served

| tool | description |
|---|---|
| `list_documents` | List all supported files in the vault folder |
| `get_document` | Read a specific file (passes through the approval gate) |
| `search_docs` | Full-text keyword search across all files |

## Default blocked patterns

These are **never** sent to AI even if requested:

```
*.env, *.env.*, *.pem, *.key, *.p12, *.pfx
*secret*, *password*, *credential*, *token*
.git/**, node_modules/**
*.sqlite, *.db
```

Add your own through the tray menu, or edit the config JSON directly.

## Layout

```
main.js                   Electron main process (tray, lifecycle)
signaling.js              WebRTC signaling server on :4445
mcp-bridge.js             stdio MCP server (the "real" surface)
mcp-bridge-testable.js    same logic with injected I/O, for unit tests
privacy-dashboard.html    in-app dashboard (preload: dashboard-preload.js)
welcome.html              first-run picker (preload: welcome-preload.js)
test/e2e.js               end-to-end Node test
assets/                   icons (tray + app)
scripts/build.sh, prebuild.js   release build helpers
```

## Status

Functional. The MCP surface is real, the WebRTC signaling works, the approval gate works. The Chrome companion is in a sibling repo. No automated CI yet.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
