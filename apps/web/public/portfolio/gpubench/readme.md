# gpubench.dev

[![CI](https://github.com/abgnydn/gpubench/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/gpubench/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live](https://img.shields.io/badge/live-gpubench.dev-6ea8ff)](https://gpubench.dev)
[![Sister](https://img.shields.io/badge/native%20version-wgpu--native--bench-orange)](https://github.com/abgnydn/wgpu-native-bench)

**How fast is your GPU in the browser?**

Real WebGPU compute benchmarks running on your hardware. No install, no account — just click Run.

**Live:** [gpubench.dev](https://gpubench.dev)

## Benchmarks

6 standard, universally recognized compute workloads:

| Benchmark | Type | Description |
|---|---|---|
| **Rastrigin** | Parallel | Standard optimization benchmark (POP=4096, DIM=2000) |
| **N-Body Simulation** | Sequential | Gravitational physics, 512 bodies, 200 fused timesteps |
| **Acrobot-v1** | Sequential | Standard Gym RL, double pendulum, 500 steps with RK4 |
| **MountainCar-v0** | Sequential | Standard Gym RL, 200 timesteps |
| **CartPole-v1** | Sequential | Standard Gym RL, inverted pendulum, 500 steps, 4→8→2 NN policy |
| **Monte Carlo Pi** | Parallel | Classic estimation, 100K samples per worker |

All benchmarks run as real WGSL compute shaders dispatched via the WebGPU API. Sequential benchmarks fuse all timesteps into a single GPU dispatch — the core technique from our [research preprint](https://doi.org/10.5281/zenodo.19342888).

## Results

400+ benchmark runs collected from real hardware:

- **Apple Metal-3** (M2/M3 Pro) — avg score 440
- **NVIDIA Blackwell** (RTX 5000 series) — avg score 334
- **AMD RDNA-4** — avg score 309
- **NVIDIA Lovelace** (RTX 4000 series) — avg score 222
- **AMD RDNA-3** — avg score 203
- **NVIDIA Ampere** — avg score 200
- **Intel Xe** — avg score 182

Data from macOS, Windows, Linux across Chrome, Safari, Firefox, and Edge.

### Transformer Fusion Results (170 runs)

Real-world speedup data from the transformer benchmark:

| GPU Vendor | Avg Speedup | Peak Speedup |
|---|---|---|
| **Apple Silicon** | 2,865× | 79,021× |
| **Qualcomm Adreno** | 623× | 13,541× |
| **NVIDIA** | 79× | 402× |
| **ARM** | 56× | 120× |

- **Mobile overall:** 15,000 tokens/sec avg, 213,000 peak
- Higher speedups on mobile reflect worse dispatch overhead on mobile GPUs — kernel fusion benefits them most

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
- **Vercel** hosting
- **Neon Postgres** (anonymous benchmark data)
- **Tailwind CSS v4**

## Development

```bash
npm install
npm run dev     # http://localhost:3000
```

## Data Collection

When users click Run, anonymous GPU stats and benchmark results are saved:
- GPU model, vendor, architecture
- Benchmark throughput (gen/s per benchmark)
- Browser and OS (from user agent)
- No personal data, no cookies, no IP logging

Privacy policy: [gpubench.dev/privacy](https://gpubench.dev/privacy)

## Pages

- `/` — Run benchmarks
- `/why` — Why kernel fusion matters (plain language)
- `/privacy` — Privacy policy
- `/api/results` — GET aggregate stats, POST benchmark results

## License

MIT

## Author

Ahmet Baris Gunaydin — [github.com/abgnydn](https://github.com/abgnydn)
