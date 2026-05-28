<!-- SPDX-License-Identifier: Apache-2.0 -->

# Changelog

All notable changes ship here. Keep entries terse, dated, and grouped by surface. Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning is [SemVer](https://semver.org/).

## [0.1.0] — 2026-04-27

Initial public release. Full migration of Tether v1 + brain agent + Veil + Zero-TVM showcase + Iris comms + KVKK profile.

### Added

- **Vault surface** — `<VaultExperience />` ported React → SolidJS. 3D orbit, drag-drop, modal viewer, search, edit. Demo seed: 20 connected docs with `[[wikilinks]]` across PARA. Empty-state "Try with demo data" path.
- **`<tether-doc>` web component** — 48.4 KB minified / 15.3 KB gzipped. KaTeX, Mermaid, Shiki lazy-load via CDN only when blocks present. Three-state wikilink resolver — no silent 404s.
- **5 WGSL kernels** — `cosineSim`, `topK` (per-workgroup bitonic, descending), `forceLayoutStep`, `tfidfSpMV`, `kHopBFS`. Live at `/dev/notes`, `/dev/search`, `/dev/orbit`. ~2 ms compute on 1M docs (M-class GPU).
- **5 Veil adapters** — WebLLM (Phi-3.5-mini-q4f16_1 default), Anthropic, Zero-TVM (git submodule, secret-tier eligible), OpenAI-compat (Ollama / LM Studio / llamafile / vLLM), transformers.js (mDeBERTa-v3 zero-shot + bert-base-multilingual-cased-ner-hrl + embeddings).
- **Veil router** — heuristic caution-biased classifier, k-anon cohort blender (Phase 8), input + fetch checkpoints, hard invariants in adapter constructors. SSE first event is the tier badge.
- **Brain agent** — persistent `claude -p` supervisor with alive-on-spawn fix, exp-backoff cap 30 s, abort-on-disconnect, crash-safe pending slot. Persona at `~/brain/agents/brain.md`.
- **Chat surface** — right rail (Apollo+Hermes brand), tier badges, tool-call cards with status pills, permission modal traps focus and Esc-denies. SSE endpoint `POST /api/brain/chat`.
- **MCP server** — 31 vault/system tools across 6 categories: 13 read (auto), 6 write (ask-15m), 5 analyze, 4 sessions (kill always-ask), 2 temple (idempotent), 1 Bash (always-ask, never-cache). `get_links` and `validate_workspace` cover BOTH inline and `[[wikilink]]` (parity bug-fix vs OLD Tether).
- **Iris comms reach** — up to 20 optional tools (10 `slack.*` via `korotovsky/slack-mcp-server`, 10 `mail.*` via `GongRzhe/Gmail-MCP-Server`). Send-actions always-ask, never-cache.
- **5 ingest formats** — md, txt, docx (mammoth), pdf (pdfjs-dist), csv/xlsx (SheetJS), UYAP `.udf` (JSZip + cp1254 RTF decode — DavaKasası unblocked).
- **Storage** — 8-table Dexie schema, FSAccess directory handle in raw IDB, lazy Y.Doc per VaultDoc with idle snapshot, "Reconnect vault" button for the permission-grant-doesn't-survive-restart case.
- **Settings panel** — Backends / Vault / Audit / Setup tabs. Zero-TVM card mounts via `lazy()` in Backends. AuditLog viewer virtualizes 100-row sliding window over up to 1000 rows, JSONL export, 5 s autorefresh.
- **Temple** — Three.js WebGPURenderer with signals-driven activation pulses at 60 fps. Same agent as the right rail, embodied skin.
- **DavaKasası sibling** — TR locale forced, KVKK profile, audit-as-home, ₺500/ay, separate Cloudflare Pages deploy, one codebase.
- **Cloudflare deploy** — `wrangler.toml` (root + workers/) with R2 + KV + DO. `apps/mcp/workers/share.ts` (`/share/:id`, hand-rolled markdown render, XSS-safe, 30 KiB) + `apps/mcp/workers/yjs-room.ts` (`YjsSignalRoom` Durable Object).
- **`/setup` installer (TCC-safe)** — macOS launchd plist, Linux systemd user unit, Windows Scheduled Task, all under `~/.tether-brain/`. Refuses if `$HOME` contains `Documents`. One-line install for all three OSes.
- **CI** — typecheck + unit + e2e on Ubuntu and macOS for every push/PR. Temple e2e gated behind `RUN_TEMPLE_E2E=1`.
- **Public-repo scaffolding** — README, CONTRIBUTING, LICENSE (Apache-2.0), issue + PR templates, screenshots manifest, CHANGELOG.

### Known soft spots

- Temple e2e flakes when `claude -p` init runs heavy in headless > 30 s — gated off CI by default.
- Iris requires manual auth (Slack stealth tokens, Gmail OAuth) — `IRIS_DISABLE_*` mutes respawn-loop noise during setup.
- Pre-deploy CF provisioning (Pages project, R2 buckets, KV namespaces, GH secrets) is one-time manual.
- Brain agent has not yet driven a real chat turn end-to-end — first acceptance gate post-release.

[0.1.0]: https://github.com/abgnydn/tether-brain/releases/tag/v0.1.0
