# MarkView Context Bridge

A Chrome Extension that injects peer-to-peer local file access into ChatGPT and Claude.ai via WebRTC.

## What This Does

When installed, this extension adds a **"MarkView · Linked"** button to the ChatGPT and Claude chat interfaces. Clicking it lets you browse and inject local files into the AI prompt — without ever uploading them to the cloud.

All data travels through an encrypted, peer-to-peer WebRTC Data Channel directly between your browser and your local machine.

## How It Works

```
Chrome Extension (this)          Your Laptop
┌──────────────────┐            ┌──────────────────┐
│  content.js      │            │  MCP Server      │
│  (ChatGPT UI)    │            │  (WebRTC mode)   │
│       ↕          │            │       ↕          │
│  offscreen.js    │◄── P2P ──►│  webrtc-transport │
│  (WebRTC + MCP)  │  (DTLS)   │                  │
└──────────────────┘            └──────────────────┘
```

## Quick Start

### 1. Start the local MCP server

```bash
cd apps/mcp
npx tsx scripts/signaling-server.ts          # Terminal 1
npx tsx src/index.ts ./docs --webrtc --room my-room  # Terminal 2
```

### 2. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select this `apps/context-injector` folder

### 3. Connect

1. Click the extension icon in the toolbar
2. Enter your Room ID (e.g., `my-room`)
3. Click **Connect to Local Context**
4. Status dot turns green: **Connected · P2P Secure**

### 4. Use on ChatGPT

1. Go to `chatgpt.com`
2. Click the **"MarkView · Linked"** button
3. Pick a local file → content is injected into the prompt
4. Hit send — ChatGPT analyzes your local file, zero uploads

## Security

- **End-to-end encrypted** via DTLS (mandatory in WebRTC)
- **Zero cloud storage** — files never touch any server
- **Zero uploads** — data travels P2P between your browser and your machine
- **Signaling server is stateless** — only brokers the initial handshake, never sees file content

## License

AGPL-3.0 — see [LICENSE](../../LICENSE)
