# wgpu-adas-bench

[![CI](https://github.com/abgnydn/wgpu-adas-bench/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/wgpu-adas-bench/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Speedup](https://img.shields.io/badge/vs%20PyTorch%20MPS-12--15×-ffb56e)](#the-number)
[![Rust](https://img.shields.io/badge/rust-stable-orange)](https://www.rust-lang.org/)

Full ADAS sensor fusion pipeline — 11 stages fused into a single GPU dispatch via `wgpu-native`. Benchmarked against the equivalent multi-kernel PyTorch implementation on the same hardware.

## The Number

**Same GPU. Same workload. 1 dispatch vs 11.**

| Config | wgpu-native | PyTorch | Speedup |
|---|---|---|---|
| R=256, C=50, T=128 | **780 fps** (1.28 ms) | 66 fps (15.2 ms) | **11.9×** |
| R=512, C=100, T=256 | **763 fps** (1.31 ms) | 50 fps (20.1 ms) | **15.3×** |
| R=1024, C=200, T=512 | **763 fps** (1.31 ms) | 60 fps (16.6 ms) | **12.7×** |

Apple M2 Pro, Metal backend. N=30 runs, 5 warmup. PyTorch 2.8.0 MPS.

ADAS needs 30 fps (33 ms). The fused version runs at 763 fps (1.3 ms) — **25× the budget**, leaving 96% of the GPU free for neural network inference.

## Pipeline

All 11 stages run in a single compute shader dispatch:

| # | Stage | What it does |
|---|---|---|
| 1 | Radar projection | Polar → Cartesian → image plane (pinhole model) |
| 2 | Cost matrix | Pairwise distance: every radar point × every camera box |
| 3 | Greedy association | Assign radar→camera via `atomicMin` (no CPU round-trip) |
| 4 | Kalman predict | 6-state constant acceleration model, covariance propagation |
| 5 | Kalman update | Fuse radar range/velocity + camera bearing into track state |
| 6 | Classification | RCS + bounding box area + velocity → object class (car/truck/ped/bike/moto) |
| 7 | Lane association | World-space lateral position → lane ID + offset |
| 8 | Time-to-collision | Range / closing velocity |
| 9 | Risk scoring | TTC × class weight × lane proximity × confidence |
| 10 | Path planning | 16 candidate trajectories × 10 timesteps, collision-aware scoring |
| 11 | Risk aggregation | Per-object worst-case path cost |

PyTorch dispatches each stage as a separate GPU kernel. Each dispatch has 5-20 μs overhead, and intermediate data round-trips through global memory. The fused shader keeps everything in registers.

## Why it's faster

Adding stages 6-11 barely changed the fused version (1.33 ms → 1.31 ms) because the extra compute stays in thread-local registers. But PyTorch went from 4 ms to 15-20 ms — each new stage adds another kernel launch + memory round-trip.

**The gap grows with pipeline complexity.** A 5-stage pipeline gave 3×. The full 11-stage pipeline gives 12-15×.

## Run

```bash
cargo build --release
./target/release/wgpu-adas-bench
```

PyTorch baseline (same workload):
```bash
python3 pytorch_sensor_fusion.py
```

For NVIDIA on Linux (Docker/vast.ai):
```bash
VK_ICD_FILENAMES=/etc/vulkan/icd.d/nvidia_icd.json ./target/release/wgpu-adas-bench
```

## Visualization

Dump a scripted highway scenario (10 objects: cars, trucks, pedestrian, cyclist, motorcycle) and visualize the full fusion output in [rerun.io](https://rerun.io):

```bash
cargo run --release -- --dump
pip install rerun-sdk numpy
python3 visualize.py
```

Shows bird's-eye view (radar detections, velocity arrows, lanes, path candidates, risk halos) and camera view (projected bounding boxes, class labels, TTC) side by side.

## Config

- **R** = radar detections per frame (64-1024)
- **C** = camera bounding boxes per frame (10-200)
- **T** = active Kalman tracks (32-512)
- Ego velocity: 25 m/s (~90 km/h highway)
- 4 lanes, 3.7 m width
- Path planning: 16 candidates, 3s horizon, 10 integration steps

## Related

- [wgpu-native-bench](https://github.com/abgnydn/wgpu-native-bench) — core compute benchmarks (Rastrigin, N-Body)
- [gpubench.dev](https://gpubench.dev) — browser GPU benchmarks (624 devices)
- [kernelfusion.dev](https://kernelfusion.dev) — kernel fusion research

## License

MIT
