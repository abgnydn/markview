# wgpu-native-bench

[![CI](https://github.com/abgnydn/wgpu-native-bench/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/wgpu-native-bench/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Sister project](https://img.shields.io/badge/browser%20version-gpubench.dev-6ea8ff)](https://gpubench.dev)
[![Rust](https://img.shields.io/badge/rust-stable-orange)](https://www.rust-lang.org/)

Same WGSL shaders as [gpubench.dev](https://gpubench.dev), running natively via `wgpu` — no browser, no framework, no overhead.

## The Number

**Same GPU. Same workload. Same machine.**

| Setup | gen/s | RTX 3090 |
|---|---|---|
| PyTorch CUDA | 680 | baseline |
| **wgpu-native (Vulkan)** | **4,543** | **6.7× faster** |

No CUDA. No Python. No framework. Same WGSL shader runs on NVIDIA, Apple, AMD, Intel, Qualcomm.

## Full Results

### NVIDIA RTX 3090 — same GPU, PyTorch CUDA vs wgpu-native Vulkan

| Benchmark | PyTorch CUDA | wgpu-native Vulkan | Speedup |
|---|---|---|---|
| **Rastrigin (POP=4096, DIM=2000)** | 680.2 gen/s | **4,542.9 gen/s** | **6.7×** |

PyTorch version: 2.10.0, CUDA 13.1. N=30 runs each, same machine.

### NVIDIA RTX 3090 — full wgpu-native results

| Benchmark | wgpu-native (Vulkan) |
|---|---|
| Rastrigin (POP=4096, DIM=2000) | **4,542.9 gen/s** (±0.01ms) |
| Rastrigin (POP=4096, DIM=100) | **8,086.9 gen/s** (±0.01ms) |
| N-Body (POP=512, N=128, 200 steps) | 2.5 gen/s |
| N-Body (POP=512, N=64, 200 steps) | 15.9 gen/s |

### Apple M2 Pro — Metal backend (all measured on same machine, N=30)

| Benchmark | wgpu-native (Metal) | PyTorch MPS | vs PyTorch |
|---|---|---|---|
| **Rastrigin (POP=4096, DIM=2000)** | **376.3 gen/s** | 77.7 gen/s | **4.8×** |
| Rastrigin (POP=4096, DIM=100) | **716.7 gen/s** | 753.7 gen/s | 0.95× |
| **N-Body (POP=512, N=128, 200 steps)** | **1.0 gen/s** | 0.5 gen/s | **2.1×** |
| **N-Body (POP=512, N=64, 200 steps)** | **4.0 gen/s** | 1.8 gen/s | **2.2×** |

On small parallel workloads (DIM=100), PyTorch MPS is competitive. On large workloads (DIM=2000) and sequential workloads (N-Body), kernel fusion wins by 2-5×. The advantage grows with workload complexity.

### Cross-platform summary (Rastrigin POP=4096, DIM=2000)

| System | gen/s | Hardware | vs PyTorch (same GPU) |
|---|---|---|---|
| **wgpu-native Vulkan** | **4,543** | **RTX 3090** | **6.7× vs PyTorch CUDA** |
| PyTorch CUDA | 680 | RTX 3090 | 1× |
| wgpu-native Metal | 358 | M2 Pro | **2.2× vs PyTorch MPS** |
| WebGPU in Chrome | 170 | M2 Pro | 1.06× vs PyTorch MPS |
| PyTorch MPS | 161 | M2 Pro | 1× |

## Why it's faster

PyTorch dispatches multiple CUDA kernels per generation (tensor ops, reductions, allocations). wgpu-native runs the entire evaluation — all 4,096 individuals × 2,000 dimensions — in a single GPU dispatch. One round-trip instead of many.

This is the same kernel fusion technique from the [paper](https://doi.org/10.5281/zenodo.19343570). It works on any GPU API, not just CUDA.

## Run

```bash
cargo build --release
./target/release/wgpu-bench
```

For NVIDIA on Linux (Docker/vast.ai):
```bash
VK_ICD_FILENAMES=/etc/vulkan/icd.d/nvidia_icd.json ./target/release/wgpu-bench
```

PyTorch baseline (same workload):
```bash
python3 pytorch_baseline.py
```

## Related

- [gpubench.dev](https://gpubench.dev) — browser benchmarks (624 devices)
- [kernelfusion.dev](https://kernelfusion.dev) — research hub
- [Paper: Kernel Fusion for Sequential Fitness Evaluation](https://doi.org/10.5281/zenodo.19343570)

## License

MIT
