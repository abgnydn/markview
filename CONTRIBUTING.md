# Contributing to MarkView

Thanks for considering a contribution to MarkView! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Project layout](#project-layout)
- [Development setup](#development-setup)
- [Making changes](#making-changes)
- [Submitting a pull request](#submitting-a-pull-request)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code.

## Project layout

MarkView is a Bun + Turbo monorepo. The whole product is **one web app and a
native desktop mirror of it**:

| Workspace | Path | What it is |
|-----------|------|-----------|
| **Web** | `apps/web` | The app — Vite + React 19 + CodeMirror 6 SPA. The main thing you'll edit. |
| **Desktop** | `apps/desktop` | Tauri 2 shell wrapping the web build (macOS / Windows / Linux). |
| **Share worker** | `apps/share-worker` | Cloudflare Worker — public share renderer + Yjs signaling. |
| **Core** | `packages/core` | `@markview/core` — framework-agnostic markdown pipeline. |

```
markview/
├── apps/
│   ├── web/             # Vite + React SPA (the editor)
│   │   ├── src/
│   │   │   ├── components/   # React components, grouped by feature
│   │   │   ├── routes/       # React Router route surfaces
│   │   │   ├── lib/          # markdown, export, collab, atmosphere, storage…
│   │   │   ├── stores/       # Zustand state
│   │   │   └── styles/       # vanilla CSS (no Tailwind)
│   │   └── public/      # static assets (paintings, demos)
│   ├── desktop/         # Tauri 2 shell
│   └── share-worker/    # Cloudflare Worker
├── packages/
│   ├── core/            # markdown engine
│   ├── eslint-config/   # shared ESLint flat config
│   └── tsconfig/        # shared tsconfig presets
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

## Development setup

### Prerequisites

- **Bun** 1.3+ (package manager + task runner)
- For the desktop app: a **Rust** toolchain + the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

### Web app

```bash
bun install        # from the repo root — installs every workspace
bun run dev        # Vite dev server (default http://localhost:3001)
```

### Desktop app

```bash
bun run dev:desktop    # builds the web frontend + launches the Tauri window
```

### Checks (run before opening a PR)

```bash
bun run typecheck                      # strict TS across workspaces
bun run lint                           # ESLint
bun --filter @markview/web build       # the static export must build
bun --filter @markview/web test        # Vitest unit tests
```

## Making changes

### Branch naming

- `feat/atmosphere-new-pack` — new features
- `fix/search-highlight-bug` — bug fixes
- `docs/update-readme` — documentation
- `perf/viewer-paint` — performance
- `refactor/split-renderer` — refactors

### Code style

- **TypeScript** (strict) for all new code; functional React components + hooks.
- **Vanilla CSS only — no TailwindCSS.** Follow the `.component-element` class
  convention and use semantic CSS custom properties.
- Keep components focused — one concern per file.

### Commit messages

Lowercase, scope-prefixed [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(atmosphere): add a new painting pack
fix(export): handle empty documents in the PDF path
perf(viewer): skip the view-transition over heavy paper
docs: refresh the architecture map
```

## Submitting a pull request

1. **Fork** the repository.
2. **Create** a feature branch from `main`.
3. **Make** focused commits.
4. **Run** the checks above locally.
5. **Push** and open a PR against `main`.

### PR guidelines

- One feature or fix per PR.
- Include screenshots / a short clip for UI changes.
- Update docs if you add or change a user-facing feature.

## Reporting bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md): steps to
reproduce, expected vs actual, browser/OS, screenshots.

## Suggesting features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md):
the problem, your proposed solution, alternatives considered.

---

Thank you for making MarkView better! 💜
