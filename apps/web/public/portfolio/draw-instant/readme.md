---
title: draw.instant
emoji: 🟠
colorFrom: red
colorTo: yellow
sdk: static
pinned: false
license: mit
short_description: As-you-type Stable Diffusion, in-browser on WebGPU
---

<div align="center">

# draw.instant

**Real Stable Diffusion, in a browser tab. Open a URL and generate — the actual
U-Net denoiser, computed on your own GPU, in the tab. No server, no upload.**

[![live](https://img.shields.io/badge/live-Cloudflare%20Workers-ff5a1f?style=flat-square&labelColor=0a0a0a)](./DEPLOY.md)
[![version](https://img.shields.io/badge/version-1.2.0-8a8a8a?style=flat-square&labelColor=0a0a0a)](./CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-4ade80?style=flat-square&labelColor=0a0a0a)](./LICENSE)
[![tests](https://img.shields.io/github/actions/workflow/status/abgnydn/draw-instant/ci.yml?style=flat-square&labelColor=0a0a0a&label=tests)](https://github.com/abgnydn/draw-instant/actions/workflows/ci.yml)
[![WebGPU](https://img.shields.io/badge/WebGPU-required-f59e0b?style=flat-square&labelColor=0a0a0a)](https://caniuse.com/webgpu)
[![no build](https://img.shields.io/badge/build-none-8a8a8a?style=flat-square&labelColor=0a0a0a)](#60-second-start)

</div>

---

## What this is

- A **browser-native, fused Stable-Diffusion-Turbo engine** — the denoising
  U-Net, VAE, and text encoder run on WebGPU, on your machine, with nothing sent
  to a server.
- A **live demonstration of WebGPU kernel fusion** — 9 U-Net building blocks
  benchmarked naive-vs-fused, with real ms and correctness numbers measured on
  *your* device the moment you open the page.
- A **from-scratch WebGPU inference stack** — a byte-level ONNX parser, a WGSL
  op-kernel library, and a graph executor, none of which import ONNX Runtime.
  Full numerical control over every dispatch.
- A **research bet** with one metric: *ms per preview refresh on a laptop you
  can buy today.*

## What this isn't

- **Not a finished product.** The fused self-hosted U-Net is mid-wiring (see
  [Status](#status) and [LIMITATIONS.md](./LIMITATIONS.md)). The ORT reference
  path generates real images today — including live, continuous-loop, and camera modes;
  the all-our-kernels path runs the VAE and is being extended to the U-Net.
- **Not faster than ORT on Apple Silicon.** On unified memory the fused path
  *ties* the naive path on the compute-bound blocks — and we publish that, in
  full, below. The win is on discrete GPUs, where launch overhead dominates.
- **Not a general ONNX runtime.** The parser and executor cover exactly the
  SD-Turbo op set, on purpose. Unsupported ops surface explicitly rather than
  silently mis-execute.
- **Not cloud-anything.** WebGPU or nothing. There is no WASM/CPU fallback by
  design — if a device can't run it, the preflight says so.

## Who it's for

- **WebGPU / kernel engineers** who want a real, non-toy fusion case study with
  reproducible on-device numbers.
- **On-device-ML researchers** measuring whether browser diffusion can cross the
  interactive latency barrier.
- **People who want private, local image generation** — no account, no upload,
  no inference bill.

---

## See it

**Live demo → deployed on Cloudflare Workers**
(`draw-instant.<your-subdomain>.workers.dev`; see [DEPLOY.md](./DEPLOY.md)). Or
run it locally in [60 seconds](#60-second-start).

The page opens with a generate panel and a column of live benchmark cards.

| Panel | What it shows |
|---|---|
| **Generate** | prompt · steps (1–8) · seed · resolution → 512×512 canvas (no guidance control — SD-Turbo is distilled to run guidance-free); one click loads the models, then as-you-type live mode, a continuous generate loop, and a camera mirror (img2img). The shared metric bar relabels itself per mode |
| **Fusion benchmark cards** | elementwise probe, FFN, attention, full transformer block, GroupNorm, Conv2d, ResNet, cross-attention, timestep-embed — each runs naive-vs-fused live and prints ms + max-abs-diff for *your* GPU |
| **Schema sniff** | one-time fetch that confirms the real SD-Turbo U-Net input/output signature |

> 📷 _Screenshots/GIF pending — they need a WebGPU browser + a one-time model
> download, so they're captured on real hardware rather than headless CI.
> Run it locally in 60 seconds (below) to see it on your own GPU._

---

## How fast — honestly, both directions

Every benchmark prints the device, the naive-vs-fused ms, and a correctness
diff, measured live in your browser. No cherry-picking. On **Apple M2**:

| Block | Naive | Fused | Result | Correctness |
|---|---:|---:|:--:|---|
| Elementwise probe (`bench.js`) | 0.10 ms | 0.03 ms | 🟢 3.2× | readback-verified at boot |
| FFN (`fused-block.js`) | 66.7 ms | 66.1 ms | 🔴 1.01× (wash) | 0 max abs diff |
| Full transformer block (`fused-block-full.js`) | 28.6 ms | 28.3 ms | 🔴 1.01× (wash) | 8.0e-7 max abs diff |

🔴 **The compute-bound blocks are a wash on Apple Silicon, and that's
expected.** Unified memory makes the global-memory round-trips that fusion
eliminates nearly free — there's little launch/bandwidth overhead left to
remove. The tiny elementwise probe is the exception: at sub-millisecond scale
it's launch-bound even on M2, and collapsing 6 dispatches to 1 shows ~2×.

🟢 **Discrete GPUs are the target.** Kernel-launch overhead dominates there.
The in-repo head-to-head on the same op chain and the same M2: fused WGSL
**0.03 ms**, our naive path **0.10 ms**, PyTorch eager MPS **0.10 ms** —
`uv run bench-torch.py` reproduces it on your machine. That eager MPS and our
naive path agree exactly is the point: both are six separate kernel launches,
measured independently. Bigger multipliers on discrete and mobile GPUs are the
thesis, and we won't quote any until they're measured from this repo — see
[BENCHMARKS.md](./BENCHMARKS.md) for the timing method, which matters more than
it sounds.

> **We publish what we measured, even when we lose.** A benchmark that hides a
> wash is worse than no benchmark.

---

## Validated against ground truth

Speed only counts behind a correctness gate. Three layers:

| Layer | Check | Gate | Runs in |
|---|---|---|---|
| **Unit** | ONNX protobuf parser round-trip (`onnx-parser-test.mjs`) | exact | Node / CI |
| **Kernel** | every WGSL op vs. a CPU reference (`wgsl-ops-test.js`, run via `ops-test.html`) | `< 1e-4` max abs diff | browser |
| **Model** | full forward pass, per-node bisect vs. the ORT reference (`*-test.html`) | first-divergent-op | browser |

The end-to-end target is a pixel diff against the reference ORT + schmuell path
at identical seed / prompt / steps, latent-L2 threshold set empirically.

---

## 60-second start

No bundler, no `npm install`, no build. Hand-authored ES modules the browser
loads directly; ORT Web and Transformers.js come from a CDN at runtime.

```bash
git clone https://github.com/abgnydn/draw-instant.git
cd draw-instant
npm start            # → python3 -m http.server 8787
# open http://localhost:8787 in a WebGPU-capable browser
```

The denoise math is a small, pure module you can read top to bottom:

```js
import { makeEulerScheduler } from './scheduler.js'

const sched = makeEulerScheduler(4)          // SD-Turbo: 1–4 steps
let latent = randn([1, 4, 64, 64], seed)
latent = mul(latent, sched.initNoiseSigma)

for (let i = 0; i < sched.timesteps.length; i++) {
  const x  = sched.scaleModelInput(latent, i)        // pre-conditioning
  const eps = unet(x, sched.timesteps[i], cond)       // noise prediction
  latent = sched.step(eps, i, latent)                 // Euler update
}
// latent → VAE decode → 512×512 canvas
```

See [Models](#models) for the one-time weight download.

---

## What's inside

- **Two execution paths, side by side** — an ORT Web reference (the number to
  beat) and our self-hosted WGSL engine (the number we're landing).
- **A from-scratch ONNX stack** — byte-level protobuf parser, WGSL op kernels,
  graph executor with buffer-pool tensor lifetimes. Zero ORT imports.
- **A pure Euler Discrete scheduler** matching `diffusers` for SD-Turbo —
  device-free, tensor-free, unit-checkable in isolation.
- **A live fusion benchmark suite** that runs on whatever GPU opens the page.

<details>
<summary><b>WGSL op coverage</b> (SD-Turbo U-Net + VAE)</summary>

| Category | Ops |
|---|---|
| Convolution | `Conv2d` (3×3, 1×1), `convMM` |
| Normalization | `InstanceNormalization`, `GroupNorm`, `LayerNorm` |
| Linear algebra | `MatMul`, `Gemm` (tiled, workgroup-staged) |
| Attention | `Softmax` (+ flash-style fused attention) |
| Resampling | `Resize` (nearest, cubic) |
| Elementwise | add · mul · sub · div · sqrt · pow · sigmoid · erf (+ broadcast) |
| Fused activations | SiLU `x·σ(x)`, GELU `x·0.5·(1+erf(x/√2))` |

</details>

<details>
<summary><b>Fused benchmark blocks</b> (naive → fused dispatches)</summary>

| File | Block | Dispatches |
|---|---|---|
| `bench.js` | elementwise chain (1M floats) | 6 → 1 |
| `fused-block.js` | FFN (GELU + residual in epilogues) | 4 → 2 |
| `fused-attn.js` | attention op (scores softmaxed on-chip, no global scratch) | 3 → 1 |
| `fused-block-full.js` | full transformer block | 14 → 9 |
| `fused-groupnorm.js` | GroupNorm | 2 → 1 |
| `fused-conv.js` | Conv2d + SiLU + residual | 3 → 1 |
| `fused-resnet.js` | ResNet block | 9 → 4 |
| `fused-cross-attn.js` | cross-attention (full softmax over S_kv=77 on-chip) | 3 → 1 |
| `fused-tembed.js` | timestep embedding | 3 → 1 |

</details>

For the full design — the parser, the op library, the executor, and the
verification strategy — read **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## Status

| Stage | State |
|---|:--:|
| UI + WebGPU preflight (f16/vendor sniff) | ✅ |
| Fusion benchmark suite (9 blocks, live, with correctness) | ✅ |
| ORT reference path (text encoder → U-Net → first latent → VAE) | ✅ |
| Pure Euler Discrete scheduler | ✅ |
| Custom WGSL engine (parser + ops + executor, runs the VAE) | ✅ |
| Self-hosted WGSL U-Net denoise loop | 🚧 |
| First end-to-end image under our own U-Net kernels | ⏳ |
| As-you-type live preview · continuous loop · live camera mirror (ORT U-Net) | ✅ |

Full v0→v5 trajectory: [ROADMAP.md](./ROADMAP.md). Version history:
[CHANGELOG.md](./CHANGELOG.md).

---

## Models

Weights come from [`schmuell/sd-turbo-ort-web`](https://huggingface.co/schmuell/sd-turbo-ort-web),
**fetched on demand and persisted via the Cache API** (`draw-instant-models`) —
the multi-GB download happens once per browser, and weights are **never
committed** (`*.onnx` is ignored). Hugging Face's no-store redirects defeat the
plain HTTP cache, which is why the bytes are stored explicitly; only the
transformers.js tokenizer path uses IndexedDB.

| Component | Size |
|---|---|
| `text_encoder/model.onnx` | ~650 MB |
| `unet/model.onnx` | ~1.73 GB |
| `vae_decoder/model.onnx` | ~99 MB |
| `vae_encoder/model.onnx` (camera mode) | ~68 MB |

**Optional local copy (WGSL U-Net path).** The WGSL loader requests
`./unet.onnx` first and falls back to Hugging Face. To skip the re-download in
development, drop the file in the repo root (it stays git-ignored):

```bash
cp /path/to/unet/model.onnx ./unet.onnx
```

---

## Engineering discipline

The non-negotiables (full text in [CONTRIBUTING.md](./CONTRIBUTING.md)):

- **Real numbers, honest numbers** — publish what you measured, including the
  washes and the losses.
- **Ship a working thing at every version** — `master` always boots.
- **Correctness gates speed** — a faster-but-wrong kernel is a regression; new
  ops land with a CPU-reference test.
- **No cloud fallback** — WebGPU or an honest "not supported."

---

## For developers

| Doc | What's in it |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | the two paths, parser, WGSL engine, verification |
| [BENCHMARKS.md](./BENCHMARKS.md) | methodology, the M2 numbers, how to reproduce |
| [LIMITATIONS.md](./LIMITATIONS.md) | what doesn't work yet and why, honestly |
| [ROADMAP.md](./ROADMAP.md) | the v0→v5 product trajectory |
| [CHANGELOG.md](./CHANGELOG.md) | version history |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | principles, dev setup, test workflow |
| [DEPLOY.md](./DEPLOY.md) | publish to Cloudflare Workers (static assets) |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | community expectations |

---

## Key numbers — single source of truth

| Symbol | Value | Context |
|---|---|---|
| Interactive bar | **< 100 ms / preview refresh** | the metric the whole repo optimizes |
| Step target | **< 100 ms / step** | on a mid-range discrete GPU (v2.5 goal) |
| Bar to beat | **~1 s** | best browser SDXL-Turbo on an RTX 4090 (ORT) |
| U-Net dispatches today | **60+ / step** | ORT Web — the overhead we're collapsing |
| Fused full block | **14 → 9 dispatches** | what the math allows at equal kernel quality |
| Fused attention | **3 → 1 dispatch** | flash-style single dispatch, softmax on-chip |
| PyTorch head-to-head | **0.03 vs 0.10 ms** | fused WGSL vs torch eager MPS, same chain + machine + timing method — `uv run bench-torch.py` |
| SD-Turbo steps | **1–4** | Euler Discrete schedule |
| Latent / image | **[1,4,64,64] / [1,3,512,512]** | VAE scaling factor 0.18215 |
| Kernel gate | **< 1e-4** | max abs diff vs. CPU reference |

---

## Companion projects

- [kernelfusion.dev](https://kernelfusion.dev) — the fusion benchmark fleet this descends from
- [gpubench.dev](https://gpubench.dev) — cross-device WebGPU throughput
- [zerotvm.com](https://zerotvm.com) — hand-written shader kernels without a compiler stack

---

## Citation

If this work is useful in research, cite it via [CITATION.cff](./CITATION.cff)
(GitHub's "Cite this repository" reads it directly).

## License

[MIT](./LICENSE) © 2026 Baris Gunaydin
