# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.1.0] — 2026-05-04

First versioned release of [gpubench.dev](https://gpubench.dev) — real
WebGPU compute benchmarks running on the user's hardware. No install, no
account, no framework — open the URL.

### Added

- **Six standard compute workloads** — Rastrigin, N-Body Simulation
  (512 bodies, 200 fused timesteps), Acrobot-v1 + MountainCar-v0 +
  CartPole-v1 (Gym RL benchmarks, 200–500 steps with RK4), and Monte
  Carlo Pi.
- **Sequential benchmarks fuse all timesteps into a single GPU dispatch**
  — the core technique from the [research preprint](https://doi.org/10.5281/zenodo.19342888)
  / [webgpu-kernel-fusion](https://github.com/abgnydn/webgpu-kernel-fusion).
- **Public results database** — 400+ submissions covering Apple Metal-3
  (M2 / M3 Pro), NVIDIA Blackwell (RTX 5000 series), and AMD RDNA-4.
  Adapter info + WebGPU limits captured per submission for reproducibility.
- **Live deployment** at https://gpubench.dev (Next.js App Router).

### Companion projects

- [wgpu-native-bench](https://github.com/abgnydn/wgpu-native-bench) — the
  same WGSL shaders running natively via Rust + `wgpu` (no browser).
- [webgpu-kernel-fusion](https://github.com/abgnydn/webgpu-kernel-fusion)
  — the umbrella research line on single-kernel fusion.
- [zerotvm.com](https://zerotvm.com) and
  [webgpu-q](https://github.com/abgnydn/webgpu-q) — sister WebGPU
  projects in the same research line.

[0.1.0]: https://github.com/abgnydn/gpubench/releases/tag/v0.1.0
