# The Town

**A medieval village simulation. 15 souls, named buildings, deterministic world generation, in-browser. Single-file build.**

> Status: **private / in progress.** Not feature-complete and not fully tested. Public release will follow polishing.

## What it is

A canvas-rendered 1400×900 medieval town with named buildings (Martha's Home, Bakery, Tavern, Chapel, Smithy, Market Square, Schoolhouse, Old Mill, Fisher's Dock, Elara's Cottage, …) connected by curved dirt-road paths radiating from Market Square as the hub. Fifteen named inhabitants ("souls") have homes, routines, personalities, traits, and emergent crises.

Deterministic pseudo-random world generation via `mulberry32` seeded with `42` — the layout is identical every reload.

Originally a single-file `town.html` demo inside [`swarm-engine`](https://github.com/abgnydn/swarm-engine). This repo is the TypeScript port (the v2), structured for further development with agents, LLM-driven cognition, audio, and richer world state.

## Architecture

| Folder | Role |
|---|---|
| `src/main.ts` | Entry point — boots the world. |
| `src/state.ts`, `src/types.ts`, `src/config.ts`, `src/storage.ts` | Core state, type model, config, persistence. |
| `src/world/` | World generation, buildings, paths, trees, building catalog. |
| `src/sim/` | Per-tick simulation loop. |
| `src/render/` | Canvas rendering, camera, sprites. |
| `src/agents/` | Souls — routines, behavior, decision-making. |
| `src/llm/` | Optional LLM cognition layer (Claude / OpenAI). |
| `src/god/` | "Demiurge" controls — world authoring from above. |
| `src/planet/`, `src/universe/` | Outer-context layers (above the town). |
| `src/audio/` | Ambient audio. |
| `src/ui/` | Sidebar, modal, settings sheet. |
| `src/mcp/` | MCP integration scaffolding. |

Single-file build via `vite-plugin-singlefile` — the entire app ships as one `index.html`.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run build        # → dist/index.html (single file)
npm run preview
```

Optional: provide a Claude or OpenAI key in the in-app settings sheet to enable LLM-driven cognition for individual souls.

## Why this is its own repo

The Town was a single demo inside `swarm-engine`'s `demos/` folder. As the TypeScript port grew (agents, LLM, audio, MCP, multi-layer world model), it stopped being just a swarm-engine showpiece and became its own project. Extracted here so it can evolve on its own pace.

## TODO before public release

- [ ] Cinematic camera + ambient audio polish
- [ ] Stable LLM-driven inner monologue per soul (currently scaffolded, not validated)
- [ ] End-to-end test of a full day cycle
- [ ] Hosted demo
- [ ] Hero screenshot / GIF for the README

## Related

- [`swarm-engine`](https://github.com/abgnydn/swarm-engine) — the parent runtime where v1 lived
- [`zero-tvm`](https://github.com/abgnydn/zero-tvm) — natural in-browser LLM substrate for soul cognition (slotted decode path)

## License

MIT — see [LICENSE](LICENSE).
