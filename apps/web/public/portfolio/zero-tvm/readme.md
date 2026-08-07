<img alt="Zero-TVM — LLMs up to a 35B sparse MoE in the browser on hand-written WGSL kernels (zerotvm.com)" src="docs/hero.png" />

# Zero-TVM

[![CI](https://github.com/abgnydn/zero-tvm/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/zero-tvm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live](https://img.shields.io/badge/live-zerotvm.com-6ea8ff)](https://zerotvm.com)
[![Bench](https://img.shields.io/badge/bench-vs%20WebLLM%20%2B%20llama.cpp-orange)](./BENCH.md)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20838918.svg)](https://doi.org/10.5281/zenodo.20838918)

**[zerotvm.com](https://zerotvm.com)** — pick a model, it runs in your tab.

Zero-TVM is an LLM inference engine for the browser, written by hand: ten
WGSL kernel roles and ~2,000 lines of TypeScript. No WebLLM, no TVM, no ONNX,
no WASM runtime.

- Models from a 3.8B dense to Qwen3.6-35B-A3B, a 256-expert sparse MoE
  (which WebLLM does not ship)
- int4 / int3 quantized weights, loaded by byte range, cached in the browser
- Paged KV cache, gated DeltaNet, sparse-MoE routing — in plain WGSL
- Layers validated against mlx_lm's own modules on the real checkpoints
- Benchmarked against WebLLM on identical weights; protocol and all numbers,
  including withdrawn claims, in [BENCH.md](BENCH.md)

## Try it

Open **[zerotvm.com](https://zerotvm.com)** and pick a model. Weights stream
from HuggingFace once, then cache in your browser (OPFS); nothing ever leaves
your machine. The shipped models — sizes, RAM requirements, `?model=` flags —
are defined in
[`src/zero-tvm/model-registry.ts`](src/zero-tvm/model-registry.ts). The site's model cards render from that table.

## Quick start

```bash
npm install
npm run dev            # Vite dev server — serves every page
npm run build          # tsc && vite build → dist/
npm run check          # typecheck + unit tests
```

Weights for local dev mirror into `.weights-local/` (see
[CLAUDE.md](CLAUDE.md) for per-model download commands); the dev server serves
them at `/local-weights/` so nothing re-downloads.

## The kernels

Every shader is hand-written WGSL in
[`src/compiler/shaders/`](src/compiler/shaders/), plus one small readable
generator for the int4/int3 matmul family. There is no compiler and no autotuner. For the other side of the
argument, [shaders.html](https://zerotvm.com/shaders) browses the TVM-generated
kernels WebLLM ships, captured live from a running session.

## How it's validated

Three layers, each catching what the previous cannot:

```bash
npm run test:kernels        # synthetic suite — every kernel vs a JS reference
npm run test:kernels:real   # real weights — layers vs mlx_lm's OWN modules
npm run test:kernels:mlx    # checkpoint repacking, byte-for-byte, no tolerance
```

The real-weight suite runs whole sub-blocks (gated DeltaNet, attention, the
MoE block, a full decoder layer) against the reference implementation's own
modules on the actual checkpoint, and greedy decode against `mlx_lm`'s output.
Performance claims are measured under the written protocol in
[BENCH.md](BENCH.md), including the negative results and the withdrawn pairs.

## Adding a model

Models whose blocks the kernel set already covers are added mechanically:

```bash
npm run add-model -- mlx-community/Qwen3-4B-4bit --param qwen3mlx
```

One command probes the checkpoint (a few hundred KB of ranged reads), checks
it against the constraint matrix, generates the `ModelSpec`, registers it on
every surface (landing cards, switcher, `?model=` URL), and compiles every
kernel under the new dims. If the model needs a kernel that doesn't exist, the
same command says exactly which one — [docs/COMPAT.md](docs/COMPAT.md) is the
full support matrix. Numerical trust comes from
`scripts/validate-model.mjs`, which diffs the browser engine's logits and
greedy decode against `mlx_lm` on the same checkpoint.

## The repository as an argument

The directory layout is the narrative arc of the project. Each page is a milestone.

```
index.html              (landing page — model picker; cards render from model-registry.ts)
compiler-chat.html      → src/compiler/chat-v2.ts  (1) WebLLM reference: captures
                                                       dispatches, our shaders replay
                                                       279 of 342 of them
zero-tvm.html           → src/zero-tvm/chat.ts     (2) The result: all dispatches
                                                       replaced, WebLLM never touched
validate.html           → src/zero-tvm/validate.ts Multi-prompt smoke test driving
                                                       src/zero-tvm/engine-core.ts
webllm-bench.html       → src/webllm-bench/main.ts (3) Honesty check: WebLLM driven
                                                       against the same local weights
                                                       for a fair head-to-head
wllama-bench.html       → src/wllama-bench/main.ts (4) Second honesty check:
                                                       llama.cpp's WebGPU backend via
                                                       wllama. GGUF, NOT the same
                                                       weight bytes — runtime AND
                                                       quantization differ (BENCH.md)

demo.html               → src/demo.ts              Dispatch timeline visualization
dump.html               → src/dump-tvm.ts          Captures all 85 TVM-emitted WGSL
shaders.html            → src/dump-shaders.ts      Browses the captured shaders
test-shaders.html       → src/compiler/test-harness.ts  Per-shader correctness vs TVM
test-chain.html         → src/compiler/test-chain.ts
```

```
src/
  zero-tvm/             THE RESULT
    engine-core.ts        ~1,000 lines — THE decode engine: buildDecodeEngine,
                          allocKVPages/allocKVPagesInt8, the 32-layer decode
                          loop. No DOM. Parameterized by mode: unfused
                          reference path (validate, 9 dispatches/layer) or
                          fused QKV+RoPE+KV-append (chat, 7/layer; 8 with int8
                          KV), plus two generate styles — blocking
                          generate/forwardLogits and the pipelined readback
                          ring (generatePipelined). Driven by BOTH chat.ts
                          and validate.ts.
    chat.ts               ~500 lines — thin chat page: DOM state, boot wiring
                          (via loading-ui's bootEngine), streaming render.
    variants.ts           ~160 lines — URL-flag A/B harness (?sg/?matmul=/
                          ?kv8=1 …) and variant→pipeline resolution.
    markdown.ts           ~170 lines — minimal streaming Markdown renderer.
    bench-console.ts      ~160 lines — window.bench / benchBatched / specSim
                          devtools harnesses for the chat page.
    spec-sim.ts           120 lines — CPU-side prompt-lookup speculative-decoding
                          acceptance simulator. Used to falsify a speed-up
                          experiment before building shaders.
    tokenizer.ts          ~280 lines — BPE tokenizer from scratch
    weight-loader.ts      ~300 lines — direct HuggingFace Phi-3-MLC fetch,
                          OPFS cache, layer-ordered streaming
    validate.ts           ~320 lines — multi-prompt forward-pass smoke test
    loading-ui.ts         ~280 lines — shared progress-bar UI + bootEngine
                          flow used by both chat and validate

  webllm-bench/
    main.ts               Head-to-head harness: WebLLM v0.2.80 wired against
                          /local-weights/* so the comparison runs on identical
                          bits. See BENCH.md.

  compiler/             THE SHADERS
    compiler.ts           ~280 lines — pipeline creation, weight buffer
                          allocation. Not an optimizing compiler — the name is
                          historical.
    shader-prelude.ts     ~70 lines — PHI3 model constants (single source of
                          truth) rendered as a WGSL `const` prelude that is
                          injected into every shader at module creation, so no
                          model-shape literal lives inside the WGSL itself.
    shaders/              18 hand-written WGSL files (~2,150 lines) + one
                          generator for the 9-variant int4_matmul family:
      add_norm.wgsl              Residual add + RMSNorm fused
      embedding.wgsl
      rms_norm.wgsl
      rope.wgsl                  (legacy, subsumed by qkv_fused)
      kv_append.wgsl             (legacy, subsumed by qkv_fused)
      kv_quantize_int8.wgsl      int8-KV opt-in path
      qkv_fused.wgsl             Q/K/V proj + RoPE + paged-KV append, 1 dispatch/layer
      qkv_fused_sg.wgsl          subgroup-reduce variant (default on Apple)
      qkv_fused_scratch.wgsl     int8-KV-compatible variant (writes full V to scratch)
      qkv_fused_tiled_sg.wgsl    experimental tile variant (regressed — kept for A/B)
      qkv_fused_tiled2sg.wgsl    experimental 2-subgroup tile variant (regressed)
      attention.wgsl             Paged attention (vLLM-style page table)
      attention_sg.wgsl          subgroup-reduce variant (default on Apple)
      attention_int8.wgsl        int8-KV opt-in path
      fused_ffn.wgsl             Gate + up + SiLU, fused
      fused_ffn_tiled_sg.wgsl    tile + subgroup variant
      int4_matmul.gen.ts         generator for the int4 matmul family — the 9
                                 former files differed only on {f16|f32 out} ×
                                 {1|4|8 rows/WG} × {tree|subgroup reduce} × {M=1|4};
                                 entry names are unchanged (int4_matmul, _sg,
                                 _tiled, _tiled8, _f32, _f32_sg, _f32_tiled,
                                 _f32_tiled8, _batched_m4). Every variant is
                                 still plain readable WGSL — dump them all with:
                                 node -e "import('./src/compiler/shaders/int4_matmul.gen.ts').then(m => console.log(m.debugDumpAll()))"
      argmax.wgsl
      argmax_sg.wgsl             subgroup variant

  tvm-shaders/          THE EVIDENCE — all 85 TVM-emitted WGSL kernels,
                        captured from a running WebLLM session by
                        src/dump-tvm.ts. Keep this next to compiler/shaders/
                        and the replacement is auditable.
```

`RESEARCH.md` is the writeup of how the shader capture worked and what reading TVM's output revealed about its kernel set. `BENCH.md` records the measured numbers, the head-to-head methodology, and the experiments that were falsified rather than shipped. `RESEARCH_STANDARDS.md` is the 15-principle engineering discipline this repo shares with its sibling WebGPU/WGSL research projects (webgpu-q quantum chemistry, webgpu-dna radiobiology, neuropulse LLM visualization) — single source of truth, falsifiable JSON artifacts, honest negatives, no fudge factors, shader byte-hashing, multi-level correctness.

## Where everything lives

| what | where |
|---|---|
| Every measured number + protocol | [BENCH.md](BENCH.md) |
| Engine documentation (per-model commands, flags, gotchas) | [CLAUDE.md](CLAUDE.md) |
| Shipped model list (the source of truth) | [`src/zero-tvm/model-registry.ts`](src/zero-tvm/model-registry.ts) |
| Reference docs + diagrams | [docs](https://zerotvm.com/docs) · [architecture](https://zerotvm.com/architecture) |
| Release history | [CHANGELOG.md](CHANGELOG.md) |

## License

MIT. See [LICENSE](LICENSE).

## Citation

This repo ships a [`CITATION.cff`](CITATION.cff), so GitHub's "Cite this
repository" button renders APA / BibTeX automatically. Each release is archived
to [Zenodo](https://zenodo.org) — cite the concept DOI
[10.5281/zenodo.20838918](https://doi.org/10.5281/zenodo.20838918) for all
versions.

```
Gunaydin, A. B. (2026). Zero-TVM: browser LLM inference on hand-written
WGSL kernels. https://zerotvm.com | https://github.com/abgnydn/zero-tvm
```
