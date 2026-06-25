# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.2.0] — 2026-06-25

Tooling, tests, and docs pass. Engine behavior is unchanged; this release adds
what makes it auditable, reproducible, and citable.

### Added

- **Headless WebGPU kernel-correctness suite** (`npm run test:kernels`) — runs
  the real WGSL kernels against independent CPU references, 8 of the 10 roles,
  via the Dawn-native binding on Mesa lavapipe (no GPU; CI-ready).
- **Auto-bench + doc-sync** (`npm run bench`) — drives both engines on a WebGPU
  GPU, writes `bench/results.json`, propagates numbers into the docs. Ships a
  Docker image + a Colab notebook for cloud GPUs.
- **Citable DOI scaffolding** — `CITATION.cff` + `.zenodo.json`.

### Changed

- README leads with the comparison table and the "~80% of WebLLM's decode
  speed" framing; refreshed the hero screenshot to the current site.
- Engine requests its WebGPU adapter with `powerPreference: 'high-performance'`.
- Migrated hosting from Vercel to Cloudflare Pages (`public/_headers` carries
  the COOP/COEP cross-origin-isolation headers).

### Fixed

- CI was red — the workflow called the renamed-away `lint` script; restored as
  an alias to `typecheck`.
- Corrected CLAUDE.md's architecture map (kernels live in
  `src/compiler/shaders/`, not `src/shaders/`).

### Removed

- 1,078 lines of provably-dead code (5 superseded prototype modules).

## [0.1.0] — 2026-05-04

First public release. **Phi-3-mini running in a browser on hand-written
WGSL shaders. No TVM. No WebLLM runtime. No compiler.**

### Headline numbers (vs WebLLM/TVM, identical model + weights)

|                                                        | WebLLM (TVM)        | Zero-TVM            |
| ------------------------------------------------------ | ------------------- | ------------------- |
| Unique WGSL kernels                                    | **85**              | **10 roles / 27 files** |
| Total WGSL lines                                       | **12,962** (gen)    | **3,078** (hand)    |
| Dispatches per decode step                             | **342**             | **228** (f16 KV)    |
| Runtime                                                | TVM → WASM scheduler | Plain TypeScript    |
| JS bundle (chat page, excl. weights)                   | 5.9 MB / 2.1 MB gz  | **157 kB / 33 kB gz** |

Zero-TVM issues **fewer** dispatches than TVM by fusing operations TVM's
default pipeline doesn't (qkv-fused incl. RoPE + paged-KV append; paged
attention + page-table read combined).

### Added

- **10 kernel roles** (27 WGSL files, counting subgroup / tiled / int8
  variants): qkv-fused, paged attention, FFN-fused, RMSNorm, RoPE,
  int4-dequant matmul, argmax sampling, and supporting kernels.
- **~2,000 lines of TypeScript** for the engine, tokenizer (BPE from
  scratch), and weight loader (direct HuggingFace fetch + OPFS cache).
- **Live demo** at https://zerotvm.com — chat UI with live throughput,
  zero-runtime architecture inspectable end-to-end.
- **Bench harness** ([BENCH.md](./BENCH.md)) — head-to-head vs WebLLM on
  identical hardware / weights.

### Companion projects

- [neuropulse.live](https://neuropulse.live) — same Phi-3-mini weights,
  every intermediate tensor rendered live as the model thinks.
- [webgpu-fusion-max](https://github.com/abgnydn/webgpu-fusion-max) — the
  "how far does it scale?" sister project pushing single-dispatch fusion
  to the same model size.
- [kernelfusion.dev](https://kernelfusion.dev) — research umbrella.

[0.2.0]: https://github.com/abgnydn/zero-tvm/releases/tag/v0.2.0
[0.1.0]: https://github.com/abgnydn/zero-tvm/releases/tag/v0.1.0
