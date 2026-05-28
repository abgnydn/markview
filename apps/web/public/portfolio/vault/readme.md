# vault

> Drag-drop your notes, PDFs, docs — watch them orbit each other in 3D by wikilinks, embeddings, and TF-IDF.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.180-orange.svg)](https://threejs.org/)
[![Yjs](https://img.shields.io/badge/Yjs-WebRTC-4f46e5.svg)](https://yjs.dev/)

```
              ·  ·    [readme.md]      ·
       [intro] ─── [chapter-1] ── [chapter-2]
          ╲              │              ╱
           ╲          [glossary]      ╱
            ╲          ╱      ╲      ╱
              [appendix-a] ── [appendix-b]
                          ·    ·
                 vault — your notes, in space
```

## Why

A folder of markdown is a list. Obsidian's graph view is a 2D snapshot. vault is the third: a continuous 3D space where every note has a position, every link is a tensioned spring, and similar docs cluster on their own without you tagging anything. Drag a new PDF in and it falls into orbit next to its semantic neighbors.

## Install

```bash
npm install @abgnydn/vault three react react-dom next \
  @react-three/fiber @react-three/drei @react-three/postprocessing \
  @huggingface/transformers dexie lucide-react marked \
  mammoth jszip docx \
  yjs y-webrtc postprocessing
```

## 60-second example

```tsx
'use client';

import { VaultExperience } from '@abgnydn/vault';

export default function MyVault() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020617' }}>
      <VaultExperience roomId={null} />
    </div>
  );
}
```

Open the page. You get the topbar, the 3D orbit, and a "Try with demo data" button — click it, 20 connected notes drop in and start orbiting by wikilinks. Drop your own `.md` / `.pdf` / `.docx` on the canvas to ingest them.

## Features

- **`<VaultExperience />`** — the whole product in one component (orbit + topbar + modal + ingest + share)
- **7 ingest formats** — `.md`, `.txt`, `.docx`, `.pdf`, `.xlsx`, `.csv`, `.udf` (Turkish UYAP)
- **Three semantic engines**, layerable:
  - wikilinks (`[[doc-name]]`) + frontmatter `permalink:` resolution
  - TF-IDF similarity edges (no model download — runs in pure JS)
  - on-device transformer embeddings via `@huggingface/transformers` (default: `Xenova/all-MiniLM-L6-v2`)
- **Graph queries** — k-hop neighbors, shortest path, ego graphs, vault hubs, community detection
- **Embodied first-person rig** — click "enter your body" to walk inside the constellation
- **Collaborative rooms** — peers share a Y.Doc over WebRTC, see each other's cursors orbiting
- **Read-only shareable URLs** — the entire vault state encoded into a URL hash, no server needed
- **i18n** — English + Turkish out of the box

## Just the pieces

If `<VaultExperience />` is too opinionated, drop down a layer:

```tsx
import {
  VaultOrbit,
  VaultModal,
  VaultTopbar,
  useVault,
  buildVaultAdjacency,
  kHopNeighbors,
  buildEmbeddingEdges,
  parseFile,
} from '@abgnydn/vault';
```

Every component, hook, and pure-function module from the barrel is independently usable — see `src/index.ts` for the full export list.

## Dev

```bash
git clone https://github.com/abgnydn/vault.git
cd vault
npm install
npm run build       # dist/index.js + dist/index.d.ts
npm run dev         # watch mode
npm run typecheck   # strict tsc
npm test            # vitest unit suites
npm run test:e2e    # Playwright (canvas, routes, topbar)
```

## Layout

```
src/
├── components/        VaultExperience, VaultOrbit, VaultModal, VaultTopbar, embodied/
├── app/               Next.js routes (solo vault + collab room)
├── lib/               WebRTC + Yjs provider, hub client
├── i18n/              en + tr (62 keys each)
├── index.ts           public barrel — start here
└── __tests__/         vitest unit suites
e2e/                   Playwright specs
dist/                  built library output (after npm run build)
```

## Performance

- 1 M-document semantic search (cosine on quantized embeddings) runs in ~2 ms in WebGPU-enabled browsers via the embedding pipeline.
- TF-IDF over 10k docs is <50 ms cold.
- Yjs sync is sub-50 ms over WebRTC on the same LAN.

## Status

Early — public API stable, no published npm tag yet. Clone + link locally with `npm pack` and `npm install ./abgnydn-vault-0.1.0.tgz`.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
