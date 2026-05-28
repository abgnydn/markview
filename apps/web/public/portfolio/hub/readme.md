# hub

> A tiny local HTTP + SSE server that exposes a markdown vault, a fleet of agent sessions, and a live event stream — for any browser tab, extension, or IDE that wants to ride alongside.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4-ff5722.svg)](https://hono.dev/)

```
   browser tab ──┐
   extension  ──┼──▶  hub :3100  ──▶  ~/brain/   (your vault)
   IDE plugin ──┘                  ──▶  agent sessions
                                   ──▶  SSE event stream
```

## What it does

A single Hono server on `http://localhost:3100` that brokers between local apps and a local vault directory:

| route | what |
|---|---|
| `GET  /hub` | a small status page (`public/hub.html`) — peek at what's running |
| `GET  /brain` | the brain dashboard (`public/brain.html`) — live view of agent sessions + vault graph |
| `GET  /api/brain/fleet` | JSON list of currently-running agent sessions |
| `GET  /api/brain/graph` | `{nodes, edges}` of the vault as a graph |
| `GET  /api/brain/events` | **SSE** stream of `tool_use` events from session JSONL logs |
| `POST /api/brain/focus/:pid` | focus the iTerm window hosting session `<pid>` |

Everything is local. No remote calls, no auth, no telemetry. It's a glorified file-watcher dressed up as an HTTP API so other apps can read the same data without hard-coding paths.

## Install + run

```bash
git clone https://github.com/abgnydn/hub.git
cd hub
npm install
npm run dev      # tsx watch on src/server.ts, default port 3100
npm start        # one-shot tsx
```

Then open http://localhost:3100/brain.

Override the port with `PORT=4000 npm start`.

## Use it from a browser tab

```js
// Live event stream
const events = new EventSource('http://localhost:3100/api/brain/events');
events.onmessage = (e) => console.log(JSON.parse(e.data));

// One-shot graph fetch
const graph = await fetch('http://localhost:3100/api/brain/graph').then(r => r.json());

// Ask iTerm to focus a session
await fetch(`http://localhost:3100/api/brain/focus/${pid}`, { method: 'POST' });
```

## Layout

```
src/
├── server.ts        Hono app + route definitions
└── lib/brain.ts     fleet / graph / events logic (file-system reads)
public/
├── hub.html         status page
└── brain.html       brain dashboard
```

## Why this exists

Apps that want to render a knowledge graph, show what an agent is doing, or trigger an iTerm focus shouldn't each re-implement file-watching, JSONL parsing, and AppleScript dispatch. Hub does it once on `:3100`, serves it over HTTP + SSE, and everything else stays thin.

## Status

Lightweight by design — 4 source files, two HTML pages. No tests yet. Designed to be forked: pin your own vault path, add your own routes.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
