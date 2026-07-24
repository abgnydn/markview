# gpubench.dev

[![CI](https://github.com/abgnydn/gpubench/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/gpubench/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live](https://img.shields.io/badge/live-gpubench.dev-6ea8ff)](https://gpubench.dev)
[![Sister](https://img.shields.io/badge/native%20version-wgpu--native--bench-orange)](https://github.com/abgnydn/wgpu-native-bench)

**How fast is your GPU in the browser?**

Real WebGPU compute benchmarks running on your hardware. No install, no account — just click Run.

**Live:** [gpubench.dev](https://gpubench.dev)

## Benchmarks

6 compute workloads (evolutionary-computation-flavored micro-kernels — see
"What the numbers mean" below):

| Benchmark | Type | Description |
|---|---|---|
| **Rastrigin** | Parallel | Standard optimization benchmark (POP=4096, DIM=2000) |
| **N-Body (frozen field)** | Sequential | 512 bodies × 200 fused timesteps against frozen initial positions — the fusable approximation, not fully coupled N-body |
| **Acrobot-v1** | Sequential | Gym-style double pendulum, 500 explicit-Euler steps, 6→16→3 NN policy |
| **MountainCar-v0** | Sequential | Gym MountainCar physics, 200 timesteps, linear policy |
| **CartPole-v1** | Sequential | Gym CartPole physics, 500 steps, 4→8→2 NN policy |
| **Monte Carlo Pi** | Parallel | Classic estimation, 100K samples per worker |

All benchmarks run as real WGSL compute shaders dispatched via the WebGPU API. Sequential benchmarks fuse all timesteps into a single GPU dispatch — the core technique from our [research preprint](https://doi.org/10.5281/zenodo.19342888).

### What the numbers mean

Two numbers are measured per benchmark:

- **gen/s** — one dispatch per submit, timed round-trip. On fast GPUs this is
  dominated by browser/driver submit overhead, not compute. It is kept for
  comparability with historical data (`bench_version = 1` protocol).
- **gen/s batched** — 8 dispatches per command buffer. Much closer to actual
  GPU throughput.

The tiny workload sizes (4096 threads) don't saturate large discrete GPUs, so
treat cross-vendor rankings on the per-submit number as a measure of the whole
browser + driver + GPU dispatch path, not of raw silicon. (That is why
Apple-silicon laptops can out-score much bigger discrete cards on it.)

## Results

890 runs across 92 unique devices and 7 GPU vendors, from macOS, Windows,
Linux, Android and iOS across Chrome, Safari, Firefox, and Edge. Every run is
public — browse or download at [gpubench.dev/results](https://gpubench.dev/results).

### Transformer fusion (fused vs unfused, same device)

Cross-vendor **medians** (means are skewed by browser measurement stalls —
e.g. Safari's unfused baseline sometimes stalls, producing outliers like
79,021× that describe Safari, not the GPU; medians filter these without an
ad-hoc outlier rule):

| GPU Vendor | Median Speedup | Peak (see caveat) |
|---|---|---|
| **Apple Silicon** | 71× | 226× |
| **NVIDIA** | 56× | 402× |
| **ARM** | 55× | 120× |
| **Qualcomm Adreno** | 20× | 103× |

- Mobile GPUs see the biggest wins — dispatch overhead is worst there, so
  kernel fusion helps them most.
- The benchmark reports two baselines: worst-case per-token decode (no KV
  cache, one submit per layer) and a fair **single-submit** unfused forward
  pass. All variants share weights and are numerically cross-checked to
  produce the same output before any timing.

## The Research

This benchmark site demonstrates kernel fusion — fusing sequential GPU dispatches into one:

- **159×** over PyTorch MPS (same M2 Pro GPU)
- **720×** over PyTorch CUDA (same Tesla T4 GPU)
- Confirmed across **4 GPU APIs**: CUDA, WebGPU, JAX/XLA, Triton
- Preprint: [doi.org/10.5281/zenodo.19342888](https://doi.org/10.5281/zenodo.19342888)
- Code + paper: [github.com/abgnydn/webgpu-kernel-fusion](https://github.com/abgnydn/webgpu-kernel-fusion)

## Tech Stack

- **Next.js 16** (App Router)
- **WebGPU** compute shaders (WGSL)
- **Cloudflare Workers** hosting (via OpenNext — see `wrangler.jsonc`)
- **Neon Postgres** (anonymous benchmark data)
- **Tailwind CSS v4**

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run check   # typecheck + lint + vitest
npm run test:e2e  # Playwright, needs a WebGPU-capable machine
```

## Data Collection

When users click Run, anonymous GPU stats and benchmark results are saved:
- GPU model, vendor, architecture
- Benchmark throughput (gen/s per benchmark, per-submit and batched)
- Browser and OS (from user agent)
- No personal data, no cookies, no IP logging

Submissions are anonymous and unauthenticated, so the server rejects
structurally implausible rows (inconsistent min/mean/max/std, impossible
throughputs) and rate-limits per IP; the dataset should still be treated as
crowd-sourced telemetry, not a controlled experiment.

Privacy policy: [gpubench.dev/privacy](https://gpubench.dev/privacy)

## Pages

- `/` — Run benchmarks
- `/transformer` — Fused vs unfused transformer decoding
- `/why` — Why kernel fusion matters (plain language)
- `/privacy` — Privacy policy
- `/api/results` — GET aggregate stats, POST benchmark results

## License

MIT

## Author

Ahmet Baris Gunaydin — [github.com/abgnydn](https://github.com/abgnydn)
