# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.1.0] — 2026-05-04

First public release. Same WGSL shaders as
[gpubench.dev](https://gpubench.dev), running natively via `wgpu` — no
browser, no framework, no overhead.

### Headline numbers

**NVIDIA RTX 3090 — same GPU, PyTorch CUDA vs wgpu-native Vulkan**

| Benchmark                          | PyTorch CUDA  | wgpu-native Vulkan | Speedup    |
| ---------------------------------- | ------------: | -----------------: | ---------: |
| Rastrigin (POP=4096, DIM=2000)     |    680.2 gen/s |  **4,542.9 gen/s** | **6.7×**   |

**Apple M2 Pro — Metal backend** (N=30 each, same machine)

| Benchmark                              | wgpu-native (Metal) | PyTorch MPS | vs PyTorch |
| -------------------------------------- | ------------------: | ----------: | ---------: |
| Rastrigin (POP=4096, DIM=2000)         |       **376.3**     |       77.7  |   **4.8×** |
| N-Body (POP=512, N=128, 200 steps)     |       **1.0**       |        0.5  |   **2.1×** |
| N-Body (POP=512, N=64, 200 steps)      |       **4.0**       |        1.8  |   **2.2×** |

### Added

- **`wgpu` benchmark harness** (Rust + WGSL) for Rastrigin and N-Body
  workloads, parameterised on POP / DIM / step count and the wgpu
  backend (Vulkan / Metal / DX12). PyTorch reference scripts live
  alongside for same-GPU apples-to-apples comparison.
- **No-CUDA, no-Python path** — all benchmarks run via `cargo run
  --release --bin <bench>` once a Rust toolchain + a wgpu-supported
  GPU driver are present.
- **Cross-platform reach** — same WGSL shader runs on NVIDIA, Apple,
  AMD, Intel, and Qualcomm; the Rust harness picks the right backend
  via `wgpu`'s adapter selection.

### Companion projects

- [gpubench.dev](https://gpubench.dev) — the same shaders running in the
  browser via WebGPU.
- [webgpu-kernel-fusion](https://github.com/abgnydn/webgpu-kernel-fusion)
  — the umbrella research line on single-kernel fusion (159–720× over
  PyTorch on the same GPU, paper companion).
- [wgpu-adas-bench](https://github.com/abgnydn/wgpu-adas-bench) — sister
  Rust harness for the ADAS sensor-fusion 11-stage pipeline.

[0.1.0]: https://github.com/abgnydn/wgpu-native-bench/releases/tag/v0.1.0
