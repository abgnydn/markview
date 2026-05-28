# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.1.0] — 2026-05-04

First public release of the kernel-fusion benchmark suite + paper companion.

### Headline results

**Same hardware: Tesla T4** (Acrobot-v1, 500 steps, RK4)

| System                       |   gen/s | vs PyTorch |
| ---------------------------- | ------: | ---------: |
| PyTorch CUDA per-step        |    0.61 |        1×  |
| Triton fused                 |   16.4  |       27×  |
| JAX `lax.scan + vmap`        |  105.1  |      172×  |
| **Hand-fused CUDA kernel**   | **439** |   **720×** |

**Same hardware: Apple M2 Pro** (Acrobot-v1, 500 steps, RK4)

| System                        |    gen/s | vs PyTorch |
| ----------------------------- | -------: | ---------: |
| PyTorch MPS per-step          |     2.52 |         1× |
| wgpu-native fused (Metal)     |    30.5  |        12× |
| WebGPU unfused (Chrome)       |    62.3  |        25× |
| **WebGPU fused (Chrome)**     | **135.9** |    **54×** |

**Financial sim** (M2 Pro, 1500 steps): WebGPU fused **46.2 gen/s** vs
PyTorch MPS 0.29 — **159× speedup**.

**MountainCar-v0** (M2 Pro, 200 steps, sequential): WebGPU fused 1,258.8
vs PyTorch MPS 18.7 — **67× speedup**.

### Added

- **Benchmark harness** (`benchmarks/`) — Rastrigin parallel optimization,
  Acrobot-v1 + MountainCar-v0 sequential RL environments, financial sim,
  N-Body sequential, Monte Carlo Pi, dim-scaling sweep, comprehensive
  multi-platform run, thermal monitoring.
- **Cross-platform reference baselines** — PyTorch (MPS, CUDA), JAX
  (`lax.scan+vmap`), Triton, NumPy variance, wgpu-native (Rust), all using
  the same workload definitions for apples-to-apples comparison.
- **Paper companion** (`paper.tex` + `PAPER.md`) — full LaTeX source +
  markdown reading copy. Conclusion: fusion advantage is GPU-API-agnostic
  (4 APIs × 2 hardware platforms verified).
- **Paper arithmetic tests** (`tests/paper_arithmetic.test.js`, 54 checks)
  — every derived number (ratio, percentage, comparison) in the paper is
  re-derived from the raw tables to catch copy-paste errors and stale
  numbers. Wired into CI.
- **Live demo** at https://kernelfusion.dev — the research umbrella for
  this and the companion projects.

### Companion projects in the same research line

- [zerotvm.com](https://zerotvm.com) — Phi-3-mini decoding via 10
  hand-written WGSL kernels (228 dispatches/token, ~40 tok/s on M2 Pro)
- [webgpu-q](https://webgpu-q.vercel.app) — quantum many-body simulation
  with kernel fusion (4.18× brick-wall fusion, ITensor-validated)
- [webgpudna.com](https://webgpudna.com) — Geant4-DNA Monte Carlo +
  Karamitros IRT chemistry in the browser
- [gpubench.dev](https://gpubench.dev) — public WebGPU benchmark harness

[0.1.0]: https://github.com/abgnydn/webgpu-kernel-fusion/releases/tag/v0.1.0
