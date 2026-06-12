# Architecture

The contributor's map of MarkView — where things live, which way dependencies
flow, and what each surface owns. Update it when the topology changes; stale
architecture docs are worse than none.

MarkView is **one product: a local-first markdown editor, shipped as a web app
and a native desktop mirror of it.** Everything below serves those two surfaces.

> History: this was once a larger monorepo (an MCP server, a hub, two Chrome
> extensions, a 3D vault/brain). Those were extracted into their own repos.
> This repo is now web + desktop only.

## Top-level layout

```
markview/
├── apps/
│   ├── web              Vite + React 19 SPA — the editor (builds to out/, static)
│   ├── desktop          Tauri 2 shell wrapping apps/web (macOS / Windows / Linux)
│   └── share-worker     Cloudflare Worker — public share renderer + Yjs signaling
├── packages/
│   ├── core             @markview/core — framework-agnostic markdown pipeline
│   ├── eslint-config    shared ESLint flat config (typescript-eslint)
│   └── tsconfig         shared tsconfig presets (base / library / node)
└── mockups/             design artifacts (not shipped)
```

## Dependency direction

```
   apps/desktop ─wraps─▶ apps/web (Tauri loads the static build)
   apps/web ─renders with─▶ packages/core
   apps/share-worker ─renders with─▶ packages/core (read-only public view)

   packages/core ◀─used by─ apps/web, apps/share-worker
```

**Invariant:** no app depends *back* on a sibling app. Packages never depend on
apps. The desktop app is a thin shell — all product logic lives in `apps/web`.

## Responsibility map

### apps/web

A **Vite + React 19 + React Router** single-page app. No server, no API routes —
it builds to a static export (`output → out/`) served by Cloudflare Pages (web)
or loaded from disk by the Tauri shell (desktop). Persistence is **IndexedDB**
(Dexie), entirely on-device.

| route | what it serves |
|---|---|
| `/` | the editor + landing (first-run shows `LandingEditor`; returning users get their workspace) |
| `/p/:slug` | a single rendered project/share page |
| `/projects` | portfolio index |
| `/projects/3d` | the projects constellation (three.js canvas) |
| `/privacy`, `/terms` | static legal pages |

**State** — Zustand stores under `src/stores/`:
- `workspace-store` — current workspace + open files
- `theme-store` — light/dark, font size, color preset, **atmosphere**
- `collab-store` — Yjs / WebRTC room state
- `annotation-store` — selection-anchored annotations
- `license-store` — premium-feature gating

**Components** grouped by feature: `components/{atmosphere,collab,landing,ui,viewer,workspace}/`.

**Lib** — each subdirectory owns one concern:
`src/lib/{markdown, export, sharing, collab, atmosphere, plugins, themes, storage, tauri}`
plus standalone modules (`embeddings.ts`, `backlinks.ts`, `annotations.ts`, …).

#### The atmosphere system

A distinctive, optional reading layer (`src/components/atmosphere/`,
`src/lib/atmosphere/`, `src/styles/zen*.css`). It paints a public-domain
painting behind the page and turns the reading surface into an antique paper
scroll. Four packs (Fuji / Wave / Snow / Fields — 30 CC0 works from The Met),
each with its own particle system (petals / spray / snow / motes), ambient
creatures, and ink palette. Pressing a key "enters" the painting: an ML/
procedural depth map drives a Gaussian-splat point cloud (three.js) you can
move through, with the documents rendered as aged-parchment cards. See
`components/atmosphere/atmospheres.ts` for the registry and rotation logic.

### apps/desktop

A **Tauri 2** (Rust + system WebView) shell. It builds `apps/web`, then bundles
`apps/web/out` as its frontend. Produces native installers for macOS
(arm64/x64), Windows (x64), and Linux (x64) via `.github/workflows/release-desktop.yml`.
Product identifier `com.markview.desktop`.

### apps/share-worker

A Cloudflare Worker with two routes:
- **share** (`src/share.ts`) — a read-only public renderer for a shared doc
  (uses `@markview/core`); documents live in R2 + KV.
- **yjs-room** (`src/yjs-room.ts`) — a Durable Object acting as the y-webrtc
  signaling endpoint for real-time collaboration.

### packages/core

Framework-agnostic markdown pipeline. Input: a markdown string + options.
Output: HTML + structured frontmatter + extracted blocks (headings, links,
code, math, tables, mermaid).

**Pipeline:** `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-raw`
→ `rehype-sanitize` (strict schema — see Security) → `rehype-stringify`.

**Optional:** Shiki, Mermaid, KaTeX are lazy-loaded only when the corresponding
block type is present.

## Security model

### Sanitization (rehype-sanitize)

The schema in `packages/core/src/pipeline.ts` is the **only** XSS defense for
user-supplied markdown. Deliberate restrictions:

- **`style` is not in the allowlist** on any element — permitting it enables
  CSS-overlay phishing (`position:fixed; inset:0` to spoof UI). Styled features
  (callouts, tints) go through a typed `className` allowlist + curated CSS.
- **`data:` URIs are not allowed for `<img src>`** — SVG-as-data-URI can carry
  inline JavaScript. Encoded images must be served over http(s).
- `script`, `style`, `iframe`, `object`, `embed`, `form`, `meta`, `link` are
  stripped entirely.

Any new `dangerouslySetInnerHTML` must take HTML that has already passed through
this pipeline.

### Privacy

No accounts, no telemetry, no remote logging. Documents live in the browser's
IndexedDB. The only outbound features are **opt-in**: P2P collaboration over
WebRTC (signaling via the worker; document data goes peer-to-peer, never through
a server) and explicit share links.

## Build pipeline

```
turbo run build
  ├── packages/core   (tsc → dist/)
  └── apps/web        (vite build → out/, static export)

apps/desktop build    depends on web#build, then tauri build → native installers
apps/share-worker     wrangler deploy (independent)
```

`apps/web` deploys to Cloudflare Pages on push to `main`
(`.github/workflows/deploy.yml`). Desktop installers ship on tags
(`.github/workflows/release-desktop.yml`).

## Conventions

- **Vanilla CSS only.** No TailwindCSS. `.component-element` class convention +
  semantic CSS custom properties.
- **No telemetry, no remote logging.** Keep the privacy pitch true.
- **Strict TypeScript** everywhere.

## Known debt

| area | state | next step |
|---|---|---|
| No CSP on the static build | the SPA ships without a Content-Security-Policy header | add one via Cloudflare Pages headers / a `_headers` file |
| WebGPU particles | compute backend draws nothing on three 0.184; shelved behind a no-op `b` key | rewrite as `InstancedMesh`/`PointsNodeMaterial` and verify live |
| `zen.css` size | the atmosphere/paper surface is a single large stylesheet | split per concern if it keeps growing |
| Orphaned landing CSS | `.landing-mcp-*` rules in `landing.css` are no longer rendered | prune |
