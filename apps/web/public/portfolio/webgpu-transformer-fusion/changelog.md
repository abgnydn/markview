# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.1.0] — 2026-05-04

First public release. **Single-kernel fusion for autoregressive
transformer decoding via WebGPU compute shaders** — proving the
technique on toy models D=32–256 before scaling to real models.

### Headline numbers (Apple M2 Pro, Chrome, SEQ=64)

| Config       | Unfused      | Fused-1T   | **Parallel (64 threads)** | vs Unfused   | vs PyTorch MPS |
| ------------ | -----------: | ---------: | ------------------------: | -----------: | -------------: |
| D=32,  L=1   |    264.6 ms  |   20.6 ms  |               **4.0 ms**  | **66×**      | **161×**       |
| D=32,  L=4   |  1,053 ms    |   77.8 ms  |              **13.8 ms**  | **76×**      |  **55×**       |
| D=64,  L=1   |    947 ms    |  145.4 ms  |               **6.6 ms**  | **144×**     | **139×**       |
| D=128, L=1   |  3,633 ms    |  430.3 ms  |              **15.8 ms**  | **230×**     |  **57×**       |
| D=256, L=1   | 14,246 ms    | 1,519 ms   |              **31.1 ms**  | **458×**     |  **44×**       |
| D=256, L=4   | 56,704 ms    | 6,033 ms   |             **201.7 ms**  | **281×**     |   **7.5×**     |

**66–458× speedup over unfused dispatch. 7.5–161× over PyTorch MPS** on
the same hardware. Zero install — runs in any WebGPU-capable browser.

### Position in the research line

| Repo                                                            | Strategy                                | Phi-3-mini |
| --------------------------------------------------------------- | --------------------------------------- | ---------: |
| **`webgpu-transformer-fusion`** (this repo, the paper)          | Single fused kernel, toy D ≤ 256        |    n/a     |
| [webgpu-fusion-max](https://github.com/abgnydn/webgpu-fusion-max) | Single fused kernel + tiling, real model | 2.2 tok/s |
| [zero-tvm](https://github.com/abgnydn/zero-tvm)                 | 10 kernel roles, hand-tuned per stage   |  ~40 tok/s |

### Added

- **Three benchmark variants**: unfused (separate GPU kernel per op),
  fused-1T (entire decode in one kernel, single thread), parallel-fused
  (one kernel, 64 threads cooperating).
- **Cross-platform reference** — JS bundle runs in any WebGPU-capable
  browser; Node bench harness (`benchmarks/bench.js`) for CLI runs.
- **Companion to [webgpu-kernel-fusion](https://github.com/abgnydn/webgpu-kernel-fusion)**,
  which proved the same technique works for sequential fitness
  evaluation (RL environments, financial sims) — this repo extends it
  to autoregressive transformer decoding.

[0.1.0]: https://github.com/abgnydn/webgpu-transformer-fusion/releases/tag/v0.1.0
