# @webgpu-fusion/core

Fused WebGPU compute kernels for transformer inference. Cross-vendor medians, fused vs unfused on the same device: **71× Apple Silicon**, **56× NVIDIA**, **20× phones** (92 unique devices, 7 GPU vendors).

One import. One dispatch. All tokens, all layers, all operations fused into a single GPU kernel — best for small-to-mid models (D≤768). For production-size transformers (D≥2048), the multi-kernel design in [`zero-tvm`](https://github.com/abgnydn/webgpu-fusion-webllm) is the right factoring; this SDK is the limit-study companion.

## Install

```bash
npm install @webgpu-fusion/core
```

## Quick Start

```js
import { FusedTransformer } from '@webgpu-fusion/core'

// Create a fused transformer (parallel mode, 64 GPU threads)
const model = await FusedTransformer.create({
  dModel: 128,
  nHeads: 2,
  nLayers: 4,
  maxSeqLen: 64,
})

// Benchmark with random weights
const stats = await model.benchmark({ runs: 10 })
console.log(`${stats.tok_per_sec.toFixed(0)} tok/s | ${stats.mean_ms.toFixed(1)} ms | 1 dispatch`)

// Or load real weights and run inference
const weights = new Float32Array(/* your model weights */)
model.loadWeightsWithDefaults(weights)

const embeddings = new Float32Array(64 * 128) // [seqLen * dModel]
const result = await model.forward(embeddings)
console.log(result.output) // Float32Array of hidden states
console.log(`${result.tok_per_sec.toFixed(0)} tok/s`)

// Clean up
model.destroy()
```

## Why This Is Fast

Current browser inference engines dispatch **separate GPU kernels** for each operation:

```
Token 1: dispatch LN → dispatch Attn → dispatch LN → dispatch FFN  (4 round-trips)
Token 2: dispatch LN → dispatch Attn → dispatch LN → dispatch FFN  (4 round-trips)
... × 64 tokens × 4 layers = 1,024 GPU round-trips
```

This library fuses everything into **1 dispatch**:

```
Single dispatch → all tokens × all layers × all ops in one kernel
```

The parallel variant uses 64 GPU threads with shared memory to also parallelize the matrix multiplications within the fused kernel.

## Benchmark Results

### Paper (Apple M2 Pro)

| Config | Unfused | Parallel Fused | Speedup | vs PyTorch MPS |
|--------|---------|---------------|---------|---------------|
| D=32, L=1 | 265 ms | **4.0 ms** | **66x** | **161x** |
| D=64, L=4 | 3,841 ms | **25.4 ms** | **151x** | **42x** |
| D=128, L=4 | 14,568 ms | **59.9 ms** | **243x** | **18x** |
| D=256, L=1 | 14,246 ms | **31.1 ms** | **458x** | **44x** |

### Real-World (92 unique devices, 7 GPU vendors)

Snapshot from [gpubench.dev](https://gpubench.dev) — medians (means are skewed by Safari-on-macOS measurement artifacts on the unfused baseline; peak values below exclude those outliers).

| GPU Vendor | Median Speedup | Clean Peak | Runs |
|---|---|---|---|
| **Apple Silicon** (M1/M2/M3) | **71x** | 226x | 65 |
| **NVIDIA** (Pascal/Turing/Ampere/Lovelace/Blackwell) | **56x** | 402x | 56 |
| **ARM Mali** | **55x** | 120x | 14 |
| **Intel** (HD/Iris/Arc) | **43x** | 84x | 10 |
| **AMD** (Radeon) | **40x** | 140x | 17 |
| **Qualcomm Adreno** (Android phones) | **20x** | 103x | 29 |

Mobile: 15,000 tok/s avg, 213,000 tok/s peak. Smaller relative speedup on phones because absolute throughput is lower — but still an order of magnitude faster than unfused.

Run it on your device: [gpubench.dev/transformer](https://gpubench.dev/transformer)

## API

### `FusedTransformer.create(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dModel` | number | required | Hidden dimension |
| `nHeads` | number | required | Attention heads |
| `nLayers` | number | required | Transformer layers |
| `ffnMultiplier` | number | 4 | FFN expansion (dModel * ffnMultiplier) |
| `maxSeqLen` | number | 256 | Maximum sequence length |
| `mode` | `'parallel'` \| `'single-thread'` | `'parallel'` | Kernel mode |
| `precision` | `'f32'` \| `'f16'` | `'f32'` | Compute precision |
| `workgroupSize` | number | 64 | Threads per workgroup (parallel mode) |

### `model.forward(embeddings, seqLen?)`

Returns `InferenceResult` with `output` (Float32Array), `elapsed_ms`, `tokens`, `tok_per_sec`.

### `model.benchmark({ warmup?, runs?, seqLen? })`

Returns `BenchmarkStats` with `mean_ms`, `std_ms`, `median_ms`, `tok_per_sec`, etc.

### `model.loadWeights(weights)` / `model.loadWeightsWithDefaults(weights)`

Load Float32Array of model weights. `WithDefaults` sets LayerNorm gamma=1, beta=0 automatically.

### `getGPU()`

Returns `{ device: GPUDevice, info: GPUInfo }` with GPU capabilities.

## Requirements

- Chrome 123+, Firefox 139+, Safari 18+ (WebGPU support)
- For f16: browser must support `shader-f16` feature

## Research

Based on two preprints:

- [Single-Kernel Fusion for Sequential Fitness Evaluation](https://doi.org/10.5281/zenodo.19331833) — 159-720x (paper, M2 Pro / T4)
- [Single-Kernel Fusion for Autoregressive Transformer Decoding](https://doi.org/10.5281/zenodo.19344276) — 66-458x (paper, M2 Pro), 71x median Apple Silicon real-world

## License

MIT
