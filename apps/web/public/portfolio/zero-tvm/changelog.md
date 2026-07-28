# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [Unreleased]

Correctness fixes, the first measured optimization promoted to default, and a
new headline number. The engine now measures **faster than WebLLM** on the
one machine benchmarked.

### Added

- **Qwen3.5-4B hybrid port (v1, `?model=qwen35`)** — the first *hybrid*
  architecture on the engine: 24 gated-DeltaNet (linear-attention) layers +
  8 gated full-attention layers (GQA 16/4, head_dim 256, partial RoPE 64 of
  256, sigmoid attention gate), 248k vocab with renumbered specials, tied
  lm_head. To our knowledge the first hand-written-kernel int4 gated-DeltaNet
  hybrid in a browser. The path is **v1-scalar-GDN** (scalar DeltaNet
  kernels, no chunked prefill — prompts replay token-by-token, unfused GDN
  projections). Suites: `npm run test:kernels:qwen35` (13/13 GDN kernel
  family vs CPU reference) + mirror-gated `tests/e2e/qwen35.test.ts`.
- **Qwen3.5 same-weights A/B vs WebLLM** — `BENCH_QUERY="?model=qwen35"
  npm run bench` runs both engines back-to-back in one session on the same
  local weight bytes. Measured pair (2026-07-28, M2 Max, Chrome 150):
  Zero-TVM **47.99** vs WebLLM **31.99** tok/s (+50.0%), WebLLM via its own
  prebuilt Qwen3.5-4B lib. Recorded in BENCH.md with the v1-scalar-GDN
  floor caveat; `bench/results.json` untouched. A `?splitk=0` vs default
  spot-check on the hybrid's 8 attention layers is recorded there too.
- **Qwen3-4B port (v1, `?model=qwen3`)** — the spec-parameterized engine now
  runs a second architecture end-to-end in the browser: GQA 32/8 with
  qDim ≠ d, per-head QK-norm, byte-level BPE tokenizer, tied lm_head, ChatML
  (non-thinking) template. `zero-tvm.html?model=qwen3` and
  `validate.html?model=qwen3`; Phi-3 stays the default and all existing URLs
  keep their exact behavior. The Qwen path is **v1-unfused** (QK-norm rules
  out the fused QKV kernel → 10 dispatches/layer; vec4 loads only where
  K % 1024 == 0; no int8-KV). Suites: `npm run test:kernels:qwen` (21/21
  compile-and-shape gate) + a mirror-gated e2e file (`tests/e2e/qwen.test.ts`).
- **Qwen3 same-weights A/B vs WebLLM** — `BENCH_QUERY="?model=qwen3"
  npm run bench` now runs BOTH engines back-to-back in one session against
  the same local weight bytes (WebLLM via its own prebuilt Qwen3-4B wasm and
  a per-model mirror route) and prints both medians + the gap, without
  touching `bench/results.json` (that stays the Phi-3 headline artifact).
  First measured pair (2026-07-28, M2 Max, Chrome 150): Zero-TVM **25.43**
  vs WebLLM **14.15** tok/s (+79.8%) — but both engines run Qwen3-4B far
  below their Phi-3 rates on this machine, so the gap reflects WebLLM's
  prebuilt Qwen3 lib as much as our v1 port. Recorded in BENCH.md as the
  baseline for the Qwen tuning phase, not promoted to any headline.

### Fixed

- **fused_ffn f32 accumulation** — the fused FFN now accumulates in f32
  throughout instead of f16.
- **Attention workgroup-barrier bug** — a missing barrier in the attention
  kernel.
- **Decode off-by-one** — the decode loop was off by one token position.

### Changed

- **`@mlc-ai/web-llm` dev-dependency bumped `^0.2.80` → `0.2.84`** — the
  Qwen3.5 hybrid model libs first ship in WebLLM's v0_2_84 prebuilt set.
  `webllm-bench` now uses the v0_2_84 lib names for all three models
  (upstream dropped the `ctx4k_` segment from the wasm names and renamed
  the `useIndexedDBCache` AppConfig flag to `cacheBackend`). The recorded
  Phi-3 / Qwen3-4B pair numbers in BENCH.md were measured against the
  v0_2_80-era libs and stand as dated history.
- **vec4 loads are now the default** (`?vec4=0` / `?vec4qkv=0` to opt out).
  Measured 2026-07-25 on Apple M2 Max vs the same-day pre-vec4 baseline of
  60.96 tok/s: `?vec4=1` +4.5%, `?vec4qkv=1` +4.2%, both together **+7.1%**
  (65.27 tok/s). Full A/B table in BENCH.md.
- **New headline head-to-head** (2026-07-25, Apple M2 Max, Chrome
  150.0.7871.182, identical local Phi-3-mini q4f16_1 weights, 128 tokens ×
  5 runs, median): Zero-TVM **66.33 tok/s** vs WebLLM v0.2.80 **51.98 tok/s**
  — **~28% faster**. Supersedes the "22% behind" M2 Pro numbers (different
  machine AND a since-fixed engine — the delta is not all optimization; the
  same-run WebLLM figure is the valid comparator). Best measured opt-in
  config `?vec4=1&vec4qkv=1&splitk=8`: 68.36 tok/s. Old M2 Pro numbers kept
  in BENCH.md "Prior measurements".
- README / BENCH.md / site copy rewritten around the measured result; the
  split-K attention flag (`?splitk=N`, ~+3% at short context) stays opt-in
  pending a long-context A/B.

### Falsified (measured and not shipped)

- **FFN prologue fusion** (`?fuseprologue=1`) — folding the FFN-entry
  add_norm into the FFN kernel's shared-memory phase measured **−13.7%**
  (52.62 tok/s) on M2 Max: the redundant per-workgroup RMSNorm recompute
  costs far more than the −32 dispatch bubbles save. Flag + shaders kept
  for A/B on other GPUs, documented as a negative result in BENCH.md —
  same treatment as the tiling and spec-decode negatives.

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
