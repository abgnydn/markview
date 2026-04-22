# MarkView Context Vault

**Privacy-first, read-only AI document bridge.**

Give AI apps (Claude Desktop, Cursor, ChatGPT) secure, read-only access to your local files — without uploading anything to the cloud.

## Features

🔒 **Read-Only** — AI can look but never touch. No file modifications, ever.

📄 **14 Formats** — Markdown, PDF, DOCX, TXT, JSON, CSV, XML, YAML, HTML, and more.

🔗 **One-Click Connect** — Auto-configures Claude Desktop and Cursor with a single click.

🛡️ **Approval Gate** — Sensitive files (`.env`, `*.key`, `*secret*`) require explicit user approval before sharing.

🚫 **File Permissions** — Glob-based block/allow patterns. Blocks `.env`, `.pem`, `.git/`, `node_modules/` by default.

📊 **Privacy Dashboard** — See exactly which files AI accessed, when, and how many times. Zero bytes leave your computer.

📋 **Full Access Log** — Every file access is timestamped and logged to a local JSON file.

🚀 **Auto-Start** — Runs silently in your menu bar on login. Always ready.

## Quick Start

```bash
cd apps/context-vault
npm install
npm start
```

1. Pick a folder when prompted
2. Click the tray icon → **Claude Desktop** to auto-configure
3. Restart Claude Desktop — it now has access to your local files

## One-Click AI App Integration

| App | How |
|-----|-----|
| **Claude Desktop** | Tray → Connect → Claude Desktop |
| **Cursor** | Tray → Connect → Cursor |
| **Chrome (ChatGPT/Claude.ai)** | Install the Context Bridge extension |

## Default Blocked Patterns

These files are **never** shared with AI:

```
*.env, *.env.*, *.pem, *.key, *.p12, *.pfx
*secret*, *password*, *credential*, *token*
.git/**, node_modules/**
*.sqlite, *.db
```

Add custom patterns via the tray menu or edit the config file directly.

## Architecture

```
┌──────────────────────────────────────┐
│  MarkView Context Vault (Electron)   │
│                                      │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  Signaling   │  │  MCP Bridge  │  │
│  │  Server      │  │  (WebRTC)    │  │
│  │  :4445       │  │              │  │
│  └─────────────┘  └──────────────┘  │
│                                      │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  Access Log  │  │  Approval    │  │
│  │  (.json)     │  │  Gate        │  │
│  └─────────────┘  └──────────────┘  │
└──────────────────────────────────────┘
         │                    │
    WebSocket/P2P        stdio/MCP
         │                    │
    Chrome Extension    Claude Desktop
    (browser AI)        Cursor, VS Code
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_documents` | List all supported files in the vault |
| `get_document` | Read a specific file (with approval gate) |
| `search_docs` | Full-text keyword search across all files |

## License

AGPL-3.0 — See [LICENSE](../../LICENSE)
