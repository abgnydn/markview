# Architecture

This document is the contributor's map of markview. It explains where things live,
which way dependencies flow, and what each surface is responsible for. Update it
when the topology changes — stale architecture docs are worse than no architecture
docs.

## Top-level layout

```
markview/
├── apps/
│   ├── web                Next.js — editor, vault, brain, agent, docs, landing
│   ├── mcp                Local MCP server (stdio + WebRTC transports)
│   ├── extension          Chrome MV3 side-panel viewer (built from apps/web/out)
│   ├── context-injector   Chrome MV3 — ChatGPT/Claude.ai → local files (WebRTC P2P)
│   └── desktop            Tauri shell wrapping apps/web
├── packages/
│   ├── core               @markview/core — framework-agnostic markdown pipeline
│   ├── react              @markview/react — React bindings for the pipeline
│   ├── webcomponent       @markview/webcomponent — `<markview-doc>` web component
│   ├── eslint-config      shared ESLint config
│   └── tsconfig           shared tsconfig presets (base / library / node / nextjs)
└── mockups/               design artifacts (not shipped)
```

## Dependency direction

```
                    ┌─────────────────────────────────────────┐
                    │           apps/web (UI)                 │
                    │  editor • vault • brain • agent demo    │
                    └─────────┬───────────────────┬───────────┘
                              │                   │
                              │ HTTP/SSE          │ WebRTC datachannel
                              ▼                   ▼
                    ┌──────────────────┐ ┌──────────────────┐
                    │ external hub     │ │ apps/mcp         │
                    │ (github.com/     │ │ stdio + WebRTC   │
                    │  abgnydn/hub)    │ │ MCP transports   │
                    └──────────────────┘ └──────────────────┘

   apps/extension ─uses─▶ apps/web (built static export)
   apps/context-injector ─peers with─▶ apps/mcp (over WebRTC)
   apps/desktop ─wraps─▶ apps/web (Tauri shell)

   packages/core ◀─uses─ apps/web, apps/mcp, packages/react, packages/webcomponent
```

**Invariant:** no app or package depends *back* on a sibling app. Packages don't
depend on apps. apps depend on packages.

## Responsibility map

### apps/web

Next.js App Router + static export (`output: 'export'`). 12 routes prerendered.

| route | what it serves |
|---|---|
| `/` | landing atlas or editor, switched by `?surface=editor|app` |
| `/vault`, `/vault/room` | 3D orbit visualizer (solo + WebRTC collab room) |
| `/brain` | live 3D view of agent sessions (needs hub at :3100) |
| `/agent` | WebRTC bridge demo (needs apps/mcp running with `--webrtc`) |
| `/docs` | rendered markdown of `src/app/docs/technical_documentation.md` |
| `/pricing`, `/privacy`, `/terms` | static marketing pages |

**State:** Zustand stores under `src/stores/` —
- `workspace-store` — current workspace + files
- `theme-store` — dark/light + custom themes
- `collab-store` — Yjs/WebRTC room state
- `annotation-store` — selection-anchored annotations
- `version-store` — per-doc version history
- `license-store` — premium-feature gating

**Components grouped by feature:** `components/{agent,collab,landing,ui,vault,viewer,workspace}/`.

**Lib:** `src/lib/{collab,export,import,markdown,mcp,plugins,sharing,storage,templates,themes}` —
each subdirectory owns one concern.

### apps/mcp

`@markview/mcp` — published to npm as the CLI `markview-mcp`. Two transports:
- **stdio** — for Claude Desktop, Cursor, Zed (the standard MCP transport)
- **WebRTC** — for browser tabs to talk to a local vault peer-to-peer

Tools are registered via `server.tool(name, schema, handler)` and exposed through
both transports. See the README's "MCP tools" table for the current surface.

### packages/core

Framework-agnostic markdown pipeline. Inputs: a markdown string + options.
Outputs: HTML + structured frontmatter + extracted blocks (headings, links,
code, math, tables, mermaid).

**Pipeline:** `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize`
(strict schema, see "Security" below) → `rehype-stringify`.

**Optional:** Shiki, Mermaid, KaTeX are peer-deps. The pipeline lazy-loads them
only when the corresponding block type is present.

## Security model

### Sanitization (rehype-sanitize)

The schema in `packages/core/src/pipeline.ts` is the **only** XSS defense for
user-supplied markdown. Two deliberate restrictions:

- **`style` attribute is NOT allowed** on any element. Permitting it enables
  CSS-overlay phishing (`position:fixed; inset:0` to spoof UI). If you need
  styled markdown features (callouts, color tints), expose them via a typed
  `className` allowlist + curated CSS — never raw `style=`.
- **`data:` URIs are NOT allowed for `<img src>`.** SVG-as-data-URI can carry
  inline JavaScript. Encoded images must be served via http(s).

### Content-Security-Policy

`apps/web/middleware.ts` sets a strict CSP on every response:
- `default-src 'self'` — third-party origins blocked by default
- `script-src 'self'` — no inline or remote JS
- `connect-src 'self' ws: wss: blob: https://stun.l.google.com:19302` — local
  hub, Yjs signaling, STUN
- `frame-ancestors 'none'` — clickjacking defense

### `dangerouslySetInnerHTML` audit

Used in 5 places, each justified:
- `app/layout.tsx` — JSON-LD `<script>` (safe; JSON.stringify escapes)
- `ui/confirm-dialog.tsx` — static CSS template (author-controlled)
- `viewer/presentation-mode.tsx` — receives pre-sanitized HTML from the pipeline
- `viewer/markdown-renderer.tsx` — same; commented `// SECURITY: sanitized via rehype-sanitize`
- `vault/vault-modal.tsx` — same

Adding a new `dangerouslySetInnerHTML` requires proving the input passes through
the sanitize pipeline first.

## Build pipeline

```
turbo run build
  ├── packages/core build (tsc → dist/index.js + .d.ts)
  ├── packages/react build (depends on core)
  ├── packages/webcomponent build
  ├── apps/web build (next build → out/, static export)
  └── apps/mcp build (tsc → dist/, publishable)
```

Husky pre-push runs `packages/core build` + `apps/web build` as a safety net.

CI runs the full turbo pipeline plus extension-manifest validation.

## Deferred / known debt

| area | state | next step |
|---|---|---|
| Test coverage | ~12% of LOC | write store tests + per-MCP-tool tests → 50%+ |
| Inline styles | 208 sites mid-migration to Tailwind | finish the migration |
| `vault-orbit.tsx` | 1543-LOC monolith | split into Scene/Camera/Nodes/Edges/Hud |
| `apps/mcp/src/index.ts` | 2732 LOC, 30 tools inline | split into `tools/<name>.ts` registered via manifest |
| Non-null assertions | 60 `!.` sites | enable `@typescript-eslint/no-non-null-assertion` + fix or comment |
| Accessibility | 9 aria, 6 roles, no axe-core in CI | add axe-core e2e suite |
| Bundle code-splitting | several 1MB+ chunks ship eagerly | `next/dynamic` for vault visualizer + 3D primitives |

## Conventions

- **Sub-project scopes:** if `apps/<x>/CLAUDE.md` exists, agents should `cd` there
  for tasks scoped to that app.
- **No commercial-license tooling.** The project is private + Apache-2.0; we don't
  ship a paywall.
- **No telemetry, no remote logging.** Per the privacy-first pitch — keep it true.
- **Consume external services via env vars.** `NEXT_PUBLIC_BRAIN_HUB_URL` for the
  hub, etc. No hard-coded production URLs in source.
