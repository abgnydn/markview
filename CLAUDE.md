# CLAUDE.md

Guidance for AI coding agents working in this repository.

## What this repo is

MarkView — a local-first markdown editor + viewer, shipped as a **web app**
and a **native desktop mirror** of it. Two surfaces, one codebase:

- `apps/web` — the app. **Vite + React 19 + React Router + CodeMirror 6**.
  Builds to a static export (`apps/web/out`), deployed to Cloudflare Pages.
  There is **no Next.js, no server, no API routes** — it's a pure SPA.
- `apps/desktop` — a **Tauri 2** shell that wraps the `apps/web` build as a
  native app (macOS arm64/x64, Windows x64, Linux x64).
- `apps/share-worker` — a Cloudflare Worker: read-only public share renderer
  + Yjs WebRTC signaling.
- `packages/core` — `@markview/core`, the framework-agnostic markdown
  pipeline (remark/rehype + optional Shiki/Mermaid/KaTeX).

> History: this was once a larger monorepo (MCP server, hub, Chrome
> extensions, a 3D vault/brain). Those were split into their own repos.
> If you find a reference to `apps/mcp`, `apps/hub`, `apps/extension`,
> `/vault`, `/brain`, or `/agent`, it is a fossil — it does not exist here.

## Stack

- **Languages:** TypeScript (strict), TSX.
- **Build:** Vite (web), Tauri/Rust (desktop), Wrangler (worker), Turbo + Bun
  workspaces at the root.
- **Styling:** **Vanilla CSS only. Do NOT use TailwindCSS.** Styles live in
  `apps/web/src/styles/` and co-located `*.css` files, scoped with the
  `.component-element` class convention and semantic CSS custom properties.

## Verification (run before shipping)

- `bun run typecheck` — strict TS across workspaces.
- `bun run lint` — ESLint (web uses the shared `@markview/eslint-config`).
- `bun --filter @markview/web build` — the static export must build.
- `bun --filter @markview/web test` — Vitest unit tests.
- For UI changes, run `bun run dev` (Vite) and verify rendering in the browser.

## Working agreement

- **Strict typing:** all new React components use strict TypeScript interfaces.
- **No placeholders:** generate full, working components.
- **Local-first + private:** zero accounts, zero telemetry, no remote logging.
  Keep it true — don't add network calls that leak document content. The only
  network features are opt-in P2P collab (WebRTC) and explicit share links.
- **Security:** user markdown is sanitized in `packages/core` (rehype-sanitize,
  strict schema — no `style=`, no `data:` image URIs). Any new
  `dangerouslySetInnerHTML` must take pre-sanitized HTML from that pipeline.
- Commit style: lowercase, scope-prefixed subjects (`feat(atmosphere):`,
  `perf(viewer):`). Body explains the *why*.
