# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.2.0] — 2026-07-24

Measurement-integrity release: the fused-vs-unfused comparison is now
verified and fair, workload labels match what the shaders actually compute,
and submissions are validated server-side.

### Fixed

- **Unfused transformer dataflow was broken** — FFN read the attention
  output instead of LN2's, each layer's FFN output was discarded, residuals
  were missing, and all layers shared one set of random weights. The unfused
  chain now mirrors the fused kernel exactly (three-buffer ping-pong with
  explicit residual bindings, per-layer weights sliced from the same packed
  tensor the fused kernel uses).
- **Parallel-fused kernel corrupted its own output** — FFN hidden scratch
  was written to `out[0..DF)`, clobbering the first tokens' final outputs.
  Scratch now lives past the `SL*D` output region.
- **Acrobot dynamics** — the `d2/d2` typo (which deleted a coupling term)
  is fixed with the actual Gym "book" equations; the false "RK4" claim is
  gone (it is explicit Euler and now says so).
- **MountainCar** ran 500 steps while every label said 200. It runs 200.
- **CartPole state was not reset on re-run**, letting a stale result leak
  into a mixed re-submission.
- **Buffer cleanup** now happens in `finally`; transformer bench buffers are
  destroyed between configs (they used to leak for the whole sweep).

### Added

- **Numerical equivalence check** — fused, unfused, and parallel variants
  run once on shared weights and are compared (`max|Δ|` logged and stored as
  `equiv_max_diff`) before any timing. Speedups over kernels that compute a
  different function are meaningless; this makes them meaningful.
- **Fair unfused baseline** — `unfused 1-submit` encodes all 4·NL passes
  into one command buffer, isolating dispatch overhead from submit overhead.
  Stored as `unfused_batched_ms` / `speedup_batched`. The old per-token,
  submit-per-layer loop is still measured, labeled as the worst case.
- **Batched-submit timing in the main benchmark** (8 dispatches per command
  buffer) alongside the historical one-dispatch-per-submit protocol, stored
  in `*_batched_gps`. Rows now carry `bench_version` (v2) so protocol
  generations are never aggregated together.
- **Server-side plausibility validation** on submissions (min ≤ mean ≤ max,
  std ≥ 0, throughput consistent with mean) — the endpoint is anonymous, so
  structurally impossible rows are rejected instead of stored.
- Vitest suite gated in CI; shader-gen invariants covered.

### Changed

- Speedups and stored timings use **medians** (means are skewed by browser
  stalls — this was already documented in `constants.ts` but not applied
  everywhere).
- All benchmark paths (detection, main bench, transformer bench) request the
  `high-performance` adapter, so dual-GPU laptops benchmark the GPU the
  leaderboard row names.
- Honest labels: N-body is described as the frozen-field approximation it is
  (fully coupled N-body cannot be fused into one dispatch); "standard Gym
  RL" claims softened to "Gym-style" where reward shaping is custom.
- `/api/setup` is a POST (side-effecting GET removed); `db.ts` checks env
  lazily so fresh clones build without Vercel env.
- README leads with median-based numbers; artifact-driven peak speedups
  (e.g. 79,021×, a Safari measurement stall) are no longer headlined.

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
