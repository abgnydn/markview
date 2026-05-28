# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

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

[0.1.0]: https://github.com/abgnydn/zero-tvm/releases/tag/v0.1.0
