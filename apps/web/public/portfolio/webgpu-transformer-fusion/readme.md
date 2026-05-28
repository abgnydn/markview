# Single-Kernel Fusion for Autoregressive Transformer Decoding via WebGPU Compute Shaders

[![CI](https://github.com/abgnydn/webgpu-transformer-fusion/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/webgpu-transformer-fusion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Speedup](https://img.shields.io/badge/vs%20unfused-66--458×-ffb56e)](#key-results-apple-m2-pro-chrome-seq64)
[![Sister: webgpu-fusion-max](https://img.shields.io/badge/sister-webgpu--fusion--max-orange)](https://github.com/abgnydn/webgpu-fusion-max)

Fusing the entire autoregressive decoding loop (all tokens x all layers x all operations) into a **single GPU compute shader dispatch** eliminates the per-dispatch overhead that dominates browser-based LLM inference. Building on [kernel fusion for sequential fitness evaluation](https://github.com/abgnydn/webgpu-kernel-fusion) (159-720x speedups), we apply the same technique to **transformer inference**.

## Key Results (Apple M2 Pro, Chrome, SEQ=64)

### Parallel Fused Kernel (66-458x)

| Config | Unfused | Fused-1T | **Parallel (64 threads)** | vs Unfused | vs PyTorch MPS |
|--------|---------|----------|--------------------------|------------|---------------|
| D=32, L=1 | 264.6 ms | 20.6 ms | **4.0 ms** | **66x** | **161x** |
| D=32, L=4 | 1,053 ms | 77.8 ms | **13.8 ms** | **76x** | **55x** |
| D=64, L=1 | 947 ms | 145.4 ms | **6.6 ms** | **144x** | **139x** |
| D=64, L=4 | 3,841 ms | 440.9 ms | **25.4 ms** | **151x** | **42x** |
| D=128, L=1 | 3,633 ms | 430.3 ms | **15.8 ms** | **230x** | **57x** |
| D=128, L=4 | 14,568 ms | 1,540 ms | **59.9 ms** | **243x** | **18x** |
| D=256, L=1 | 14,246 ms | 1,519 ms | **31.1 ms** | **458x** | **44x** |
| D=256, L=4 | 56,704 ms | 6,033 ms | **201.7 ms** | **281x** | **7.5x** |

**66-458x speedup** over unfused dispatch. **7.5-161x over PyTorch MPS** on the same hardware. Zero installation — runs in any WebGPU-capable browser.

## What This Proves

Current browser LLM engines (WebLLM, Transformers.js) dispatch separate GPU kernels for each operation at each token position:

```
Token 1: dispatch LayerNorm → dispatch Attention → dispatch LayerNorm → dispatch FFN
Token 2: dispatch LayerNorm → dispatch Attention → dispatch LayerNorm → dispatch FFN
... × 64 tokens × 4 layers = 1,024 GPU round-trips
```

The fused kernel does it all in **one dispatch**:

```
Single dispatch: for each token { for each layer { LN → Attn → LN → FFN } }
= 1 GPU round-trip
```

Same math. Same output. **6.5-13.7x faster.**

## How It Works

The fused WGSL compute shader:

1. **Loops over tokens** inside the shader (no CPU round-trip between tokens)
2. **Loops over layers** inside the shader (no dispatch per layer)
3. **Computes LayerNorm, Attention, FFN inline** (no intermediate buffer writes)
4. **Maintains KV cache** in GPU storage buffers
5. **Keeps token state in thread-local registers**

This is the same pattern from our [fitness evaluation paper](https://doi.org/10.5281/zenodo.19343570) — instead of 1,500 timesteps of financial simulation, it's 64 tokens of transformer decoding.

## Run It Yourself

### Prerequisites

- Chrome 120+ (WebGPU enabled by default)
- Node.js 18+

### Quick Start

```bash
npm install
npm run dev
# Open http://localhost:5173
# Click "Run Full Sweep"
```

The sweep runs all 9 configurations (D=32/64/128, L=1/2/4) and displays results in-browser.

## Repository Structure

```
paper.tex                           # Paper (ACM sigconf LaTeX)
index.html                          # Benchmark UI
src/
  benchmark.js                      # Sweep runner (fused vs unfused, all configs)
  shader-gen.js                     # Parameterized WGSL shader generator
  shaders/
    fused_transformer.wgsl          # Single-dispatch fused kernel (D=32 reference)
    unfused_layernorm.wgsl          # Separate LayerNorm dispatch
    unfused_attention.wgsl          # Separate causal attention dispatch
    unfused_ffn.wgsl                # Separate FFN dispatch
```

### Key Files

- **[shader-gen.js](src/shader-gen.js)** — Generates fused and unfused WGSL shaders for any `(D, heads, FFN, seq_len, layers)` configuration. Constants baked at generation time, matching the pattern from `webgpu-kernel-fusion`.

- **[fused_transformer.wgsl](src/shaders/fused_transformer.wgsl)** — The core contribution: a single compute shader that implements `LayerNorm → Attention → LayerNorm → FFN` looped over all tokens and layers. KV cache in storage buffers, token state in registers.

- **[benchmark.js](src/benchmark.js)** — Runs the full sweep: for each config, creates both fused and unfused pipelines, times them with warmup, reports median.

## Architecture

### Unfused (how current browser LLM engines work)

```
Per token, per layer:
  CPU → GPU: dispatch LayerNorm shader     (1 round-trip)
  CPU → GPU: dispatch Attention shader     (1 round-trip)
  CPU → GPU: dispatch LayerNorm shader     (1 round-trip)
  CPU → GPU: dispatch FFN shader           (1 round-trip)

Total: 4 × L × T dispatches
  L=4, T=64 → 1,024 dispatches
```

### Fused (this work)

```
CPU → GPU: dispatch fused transformer shader (1 round-trip)
  Inside shader:
    for t in 0..T:
      for l in 0..L:
        LayerNorm (inline, registers)
        Attention (inline, KV cache in storage buffer)
        LayerNorm (inline, registers)
        FFN (inline, registers)

Total: 1 dispatch
```

### Transformer Config

| Parameter | Values Tested |
|-----------|--------------|
| D_MODEL   | 32, 64, 128 |
| N_HEADS   | 2 |
| D_FFN     | 4x D_MODEL |
| SEQ_LEN   | 64 |
| Layers    | 1, 2, 4 |
| Precision | f32 |

## Dispatch Overhead Analysis

At D=32, each operation takes ~0.08 ms of compute but ~0.94 ms of dispatch overhead. **92% of wall-clock time is dispatch overhead**, not actual GPU computation.

At D=128, per-operation compute grows to ~1.7 ms but dispatch overhead is still ~12.4 ms per token. **88% overhead** — it does not vanish at larger model sizes.

## Limitations

- **Single-thread fused kernel.** Uses `workgroup_size(1)` — parallelizing across the hidden dimension would improve fused performance at larger D.
- **Small model sizes.** D=128 is far from production LLMs (D=2048-4096). Register pressure becomes a constraint.
- **M2 Pro only.** Cross-vendor testing (NVIDIA via Chrome/Vulkan, AMD) is needed.
- **f32 only.** Production inference uses f16/int4 quantization.
- **Random weights.** Measures throughput, not generation quality.

## Related Work

- **[webgpu-kernel-fusion](https://github.com/abgnydn/webgpu-kernel-fusion)** — Prior work: 159-720x fusion gains for sequential fitness evaluation (financial sim, Acrobot, MountainCar)
- **[gpubench.dev](https://gpubench.dev)** — Live GPU benchmark using the same WebGPU compute shader patterns
- **FlashAttention** — Fuses attention sub-operations but not across token positions or layer boundaries
- **WebLLM** — Browser LLM inference via TVM → WebGPU (uses unfused per-operation dispatch)
- **Transformers.js** — Browser inference via ONNX Runtime Web (uses unfused dispatch)

## Hardware

- **GPU:** Apple M2 Pro (19-core GPU, 32 GB unified memory)
- **Browser:** Chrome 123, WebGPU enabled
- **OS:** macOS 14

## Citation

```bibtex
@article{gunaydin2026transformerfusion,
  title={Single-Kernel Fusion for Autoregressive Transformer Decoding via WebGPU Compute Shaders},
  author={Gunaydin, Ahmet Baris},
  year={2026}
}
```

## License

MIT
