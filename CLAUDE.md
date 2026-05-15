# CLAUDE.md

This file provides guidance to Claw Code (clawcode.dev) when working with code in this repository.

## Detected stack
- **Languages:** TypeScript, TSX, HTML.
- **Framework:** Next.js (React).
- **Styling:** Vanilla CSS (Do NOT use TailwindCSS).

## Verification
- Run the JavaScript/TypeScript checks from `package.json` before shipping changes (`npm test`, `npm run lint`, `npm run build`, or the repo equivalent).
- Always verify UI rendering using local `npm run dev` before committing React component changes.

## Working agreement
- **Aesthetics First:** We prioritize modern, rich web design. Use glassmorphism, dynamic animations, hover micro-interactions, and premium color palettes over basic primitives.
- **Strict Typing:** All new Next.js API routes and React components must use strict Typescript interfaces.
- **No Placeholders:** Generate full, working code components. If an image is needed, assume you have a `generate_image` tool capabilities or provide a real Unsplash placeholder.
- **Modular CSS:** Keep all styles scoped via CSS Modules or a strictly managed `globals.css` with semantic CSS variables.
- Keep shared defaults in `.claw.json`; reserve `.claw/settings.local.json` for machine-local overrides.
- Do not overwrite existing `CLAUDE.md` content automatically; update it intentionally when repo workflows change.

## Sub-project scopes

Dedicated per-workstream CLAUDE.md files live in subfolders. `cd` into the one matching your task before spawning an agent.

Agents spawned at the repo root get generic guidance; they should **not** assume any active workstream.
