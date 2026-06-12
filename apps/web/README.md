# @markview/web

Markview's web SPA — Vite + React + CodeMirror 6. Single-page editor
that renders, edits, searches, exports, and shares markdown locally.

## Run

```bash
bun install           # from repo root, installs all workspaces
bun run dev           # serves at http://localhost:3001
```

## Build

```bash
bun --filter @markview/web build   # output → apps/web/out
```

Apps/desktop's Tauri shell consumes `apps/web/out` as its frontend.

## Deploy

The web build deploys to Cloudflare Pages on every push to `main` via
`.github/workflows/deploy.yml` (it builds `apps/web` and runs
`pages deploy apps/web/out`). Desktop installers ship separately on tags
via `.github/workflows/release-desktop.yml`.

## Editor surface

- `src/components/viewer/markdown-editor.tsx` — CodeMirror 6 overlay
  with the zen theme, optional y-collab binding for real-time multi-user
  editing.
- `src/components/viewer/markdown-renderer.tsx` — Shiki + Mermaid + KaTeX
  rendering pipeline.
- `src/styles/zen.css` — the vanishing-chrome layer. Hover the top edge
  of the viewport to reveal the toolbar; hover left for the sidebar;
  hover right for the table of contents.
