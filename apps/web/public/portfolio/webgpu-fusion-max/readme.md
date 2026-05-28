# webgpu-fusion-max

[![CI](https://github.com/abgnydn/webgpu-fusion-max/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/webgpu-fusion-max/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Speedup](https://img.shields.io/badge/decode%20speedup-11×-ffb56e)](#the-result)
[![Sister: zero-tvm](https://img.shields.io/badge/sister-zero--tvm-orange)](https://github.com/abgnydn/zero-tvm)

**Pushing single-dispatch transformer fusion to a real model: Phi-3-mini (3.6B params, D=3072) running in Chrome via tiled WebGPU compute shaders.**

This is the "how far does it scale?" companion to [`webgpu-transformer-fusion`](https://github.com/abgnydn/webgpu-transformer-fusion) (the paper, which proved the technique on toy models D=32–256) and [`zero-tvm`](https://github.com/abgnydn/zero-tvm) (the production-shaped 10-kernel design at the same model size).

The three repos answer the same question — *what's the right factoring for browser LLM inference?* — at three different points on the dispatch spectrum.

| Repo | Strategy | Dispatches per token | Phi-3-mini throughput |
|---|---|---|---|
| [`webgpu-transformer-fusion`](https://github.com/abgnydn/webgpu-transformer-fusion) | Single fused kernel, tiny models | 1 | n/a (D ≤ 256 toy) |
| **`webgpu-fusion-max`** (this repo) | **Single fused kernel, real model with tiling** | **~1** | **2.2 tok/s on M2 Pro** |
| [`zero-tvm`](https://github.com/abgnydn/zero-tvm) | 10 kernel roles, hand-tuned per stage | 228 | ~40 tok/s on M2 Pro |

## The result

**Phi-3-mini-3.6B running end-to-end in Chrome at 2.2 tok/s, vs a 0.2 tok/s unfused baseline — 11× decode speedup** at the model size people actually deploy. Single GPU dispatch per token, including all 32 transformer layers. Tiled FFN + tiled attention to keep register and workgroup-memory pressure manageable at D=3072.

## Why it's slower than `zero-tvm`

zero-tvm runs at ~40 tok/s with **228 dispatches per token**. This repo runs at ~2.2 tok/s with **~1 dispatch per token**. That ~18× gap is the finding: at D=3072, dispatch overhead is real but not dominant. Once you fuse everything into one shader, you give up the GPU's ability to pick optimal launch geometry for each stage (Q/K/V projection, attention, and FFN want different parallelism), and that loss is bigger than the dispatch-overhead saving.

This is exactly why `zero-tvm` is the production design — it picked 10 kernel roles deliberately, after this experiment measured the limit of the other extreme.

## Status

Proof-of-concept. The tiling tactics here are candidates for backporting into the production fusion SDK once the v2 refactor lands.

## What's in here

- `src/test-phi3.html`, `src/test-phi3-full.html` — the Phi-3-sized fused-kernel runs.
- `src/test-tiled.html`, `src/test-fusedqkv.html`, `src/test-ultra.html` — tiling and fused-QKV ablations.
- `src/test-int4.html`, `src/test-predequant.html` — int4 quantization paths.
- `src/test-bigwg.html`, `src/test-multicore.html`, `src/test-regopt.html`, `src/probe-limits.html` — workgroup geometry, multi-core scheduling, register pressure, and device-limit probing experiments.
- `src/bench.html` — sweep harness.
- `results/2026-03-31_int4.json` — measurement artifact.

## Run

```bash
npm install
npm run dev
# open the page in src/ you want to run
```

Requires Chrome / Edge with WebGPU and the `shader-f16` feature.

## License

MIT — see [LICENSE](LICENSE).
