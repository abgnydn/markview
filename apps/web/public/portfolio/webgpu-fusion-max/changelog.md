# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.1.0] — 2026-05-04

First public release. **Phi-3-mini (3.6B params, D=3072) running in Chrome
via tiled WebGPU compute shaders, in a single GPU dispatch per token.**

### Headline numbers (Apple M2 Pro, Chrome, Phi-3-mini)

|                                |  tok/s | Dispatches per token |
| ------------------------------ | -----: | -------------------: |
| Unfused baseline               |   0.2  |              ~thousands |
| **`webgpu-fusion-max` (fused)** | **2.2** |               **~1** |

**11× decode speedup** at the model size people actually deploy. All 32
transformer layers + paged-KV attention + tiled FFN + RMSNorm + RoPE in
one dispatch.

### Position in the research line

| Repo                                                                       | Strategy                                | Dispatches/tok | Phi-3-mini |
| -------------------------------------------------------------------------- | --------------------------------------- | -------------: | ---------: |
| [webgpu-transformer-fusion](https://github.com/abgnydn/webgpu-transformer-fusion) | Single fused kernel, toy models  |             1  |    n/a (D ≤ 256) |
| **`webgpu-fusion-max`** (this repo)                                        | **Single fused kernel + tiling**        |          **~1** | **2.2 tok/s** |
| [zero-tvm](https://github.com/abgnydn/zero-tvm)                            | 10 kernel roles, hand-tuned per stage   |           228  |     ~40 tok/s |

The three repos answer the same question — *what's the right factoring
for browser LLM inference?* — at three different points on the dispatch
spectrum. Tiled FFN + tiled attention keep register and workgroup-memory
pressure manageable at D=3072.

### Companion projects

- [kernelfusion.dev](https://kernelfusion.dev) — research umbrella.
- [neuropulse.live](https://neuropulse.live) — same Phi-3-mini, every
  intermediate tensor rendered live.

[0.1.0]: https://github.com/abgnydn/webgpu-fusion-max/releases/tag/v0.1.0
