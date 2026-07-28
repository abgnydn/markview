<img alt="Zero-TVM — run Phi-3 in the browser on 10 hand-written WGSL kernels (zerotvm.com)" src="docs/hero.png" />

# Zero-TVM

[![CI](https://github.com/abgnydn/zero-tvm/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/zero-tvm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live](https://img.shields.io/badge/live-zerotvm.com-6ea8ff)](https://zerotvm.com)
[![Bench](https://img.shields.io/badge/bench-vs%20WebLLM-orange)](./BENCH.md)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20838918.svg)](https://doi.org/10.5281/zenodo.20838918)

**[zerotvm.com](https://zerotvm.com)**

**Phi-3-mini (3.8B) running in the browser on 10 hand-written WGSL kernels — measured 28–31% faster than WebLLM's decode on an Apple M2 Max, with no TVM, no compiler, and no WASM runtime.**

| | WebLLM (TVM) | Zero-TVM (this repo) |
|---|---|---|
| Decode speed (M2 Max, same weights, same run) | **<!--bench:webllm-->47.9<!--/bench:webllm--> tok/s** | **<!--bench:zt-->62.90<!--/bench:zt--> tok/s** (ratio stable −28…−31% across sessions, see [BENCH.md](BENCH.md)) |
| Unique WGSL kernels | **85** (autotuned) | **10 roles / 27 kernels** (18 .wgsl + 9 generated int4 variants) |
| Total WGSL lines | **12,962** (generated) | **~2,150** hand-written + a 280-line readable generator |
| Dispatches per decode step | **342** | **228** (f16 KV) / **260** (int8 KV) |
| Runtime | TVM → WASM scheduler | Plain TypeScript, none |
| Tokenizer | bundled from WebLLM | BPE from scratch (`tokenizer.ts`) |
| JS bundle (chat page, excl. weights) | **5.9 MB** / 2.1 MB gz | **157 kB** / 33 kB gz |

Same model, same quantized weights. [WebLLM / MLC-LLM](https://webllm.mlc.ai/) — the standard way to run a browser LLM — ships an Apache-TVM pipeline that emits 85 autotuned WGSL kernels driven from a WASM scheduler. This repo replaces that whole stack with **10 kernel roles (27 WGSL kernels — 18 hand-written files plus 9 int4-matmul variants emitted by a small readable generator, counting subgroup/tiled/int8 variants) and ~2,000 lines of TypeScript** (engine + tokenizer + weight loader) — and, as of the 2026-07-25 head-to-head, decodes faster than it on the one machine measured. The whole forward pass — 32 transformer layers, paged KV cache, int4-dequant matmul, RoPE, fused FFN, RMSNorm, paged attention, argmax sampling — is readable end-to-end in a single sitting. That is the point.

## What's actually in the box

Numbers above are measured from the source and build output in this repo; throughput varies by GPU, shows live in the chat UI, and the full head-to-head (methodology + raw runs) is in [BENCH.md](BENCH.md). Zero-TVM issues **fewer** dispatches than TVM because it fuses operations TVM's default pipeline doesn't:

- `qkv_fused.wgsl` — Q/K/V projection + RoPE + paged-KV append, one dispatch per layer (was 3 in earlier revisions and in TVM's emission).
- `attention.wgsl` — paged attention combined with the page-table read.
- `fused_ffn.wgsl` — gate + up + SiLU in one pass.
- `add_norm.wgsl` — residual add + RMSNorm in one pass.

Counting note: "10 kernel roles" counts the default f16-KV decode path. By file
basename there are 11 prefixes — the eleventh, `kv_quantize_int8.wgsl`, only
runs on the opt-in `?kv8=1` int8-KV path.

Every FLOP the model executes is in a file you can open. Every GPU buffer has a human label. Every dispatch is annotated in `src/zero-tvm/engine-core.ts` — the single decode engine that both the chat page and the validation page drive.

## Why this might be interesting

Hand-written GPU kernels usually lose significantly to an autotuning compiler. The claim this repo is designed to test is: **for a decoder-only LLM of this shape, most of the compiler's complexity budget isn't buying much.** The expensive parts are matmul, attention, and int4 dequant. Everything else is plumbing. ~10 kernels of plumbing, instead of 85.

Measured result on an Apple M2 Max, Chrome 150, identical Phi-3-mini-q4f16_1 weights, same-run head-to-head: **Zero-TVM decodes 28–31% faster than the autotuned compiler across sessions** (absolute tok/s drifts with machine state; the ratio is stable — the current medians are in the table above and in [BENCH.md](BENCH.md), synced from `bench/results.json`). Full methodology and A/B results in [BENCH.md](BENCH.md), including three tile-variant experiments, a prompt-lookup speculative-decoding experiment, and an FFN-prologue-fusion experiment that were *falsified* by measurement rather than shipped. (An earlier measurement on an M2 Pro with an older, buggier engine put this repo 22% *behind* WebLLM — that history is preserved, not retconned, in BENCH.md.)

The scope of that number matters: one machine, one model, one browser, decode-only, short-context bench. But within that scope the question the repo was built to test now has a sharper answer — the ten hand-written kernels aren't merely "close enough" to the 85 autotuned ones; on this hardware they win. The repo also makes the stack *auditable*: if you want to instrument a layer, add a new fusion, test a different attention pattern, or teach someone how browser LLM inference works at the metal, there is no compiler in the way — just WGSL and a few hundred lines of TypeScript orchestrating it.

The closest reference point is Karpathy's [llm.c](https://github.com/karpathy/llm.c) (hand-written CUDA/C GPT-2). This is that thesis — *you don't need the giant framework* — ported to browser / WebGPU / int4 / paged KV / modern arch, for a model people actually use.

## How to run

**Requirements:** A recent Chrome or Edge with WebGPU enabled and the `shader-f16` feature available. Tested on macOS (M2 Pro / M2 Max, Chrome 120–150). Other platforms should work but are untested.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/zero-tvm.html>. On first load the browser downloads the Phi-3-mini-4k-instruct Q4 weights from HuggingFace (~1.8 GB) and caches them in OPFS (Origin Private File System). Subsequent loads are instant.

To build a deployable bundle:

```bash
npm run build   # → dist/
```

The build produces a multi-page Vite output: `index.html` (landing page — project overview, shader catalog, compare table), `zero-tvm.html` (chat demo), `compiler-chat.html`, `demo.html` (dispatch visualization), `validate.html` (multi-prompt smoke test), `webllm-bench.html` (head-to-head harness), `architecture.html`, `docs.html`, `dump.html` (TVM shader capture), `shaders.html` (captured-shader browser).

### URL flags

`zero-tvm.html` accepts a handful of query flags for A/B-ing shader variants without rebuilding. Defaults are tuned for Apple GPUs; flags let you isolate a path:

- `?sg=0` — disable all subgroup shaders (argmax / attention / QKV matmul)
- `?sgqkv=0` / `?sgattn=0` / `?sgargmax=0` — disable one at a time
- `?qkvtile=1` / `?qkvtile2=1` — opt into tiled QKV variants (both regressed on M2 Pro — kept for portability testing)
- `?ffnsg=1` — opt into the tiled-subgroup fused FFN
- `?kv8=1` — opt into the int8 KV cache path (`kv_quantize_int8` + `attention_int8`)
- `?vec4=0` / `?vec4qkv=0` — opt OUT of the vec4<u32> weight + activation loads in the int4 matmuls / `qkv_fused`. Default ON since 2026-07-25: measured +7.1% together on M2 Max (see BENCH.md)
- `?splitk=N` — split-K flash-decode attention, N ∈ 2..16 partitions per head + combine pass; f16 KV only. **Default N=8** since the long-context A/B (+3.1% at 128-token, +4.0% at 1024-token decode on M2 Max); `?splitk=0` to disable
- `?fuseprologue=1` — fold the FFN-entry add_norm into the FFN kernel's prologue, `add3_norm` at the layer tail. Measured −13.7% on M2 Max — a documented negative result, kept for A/B on other GPUs

Open DevTools and `window.specSim(160, 3, 3)` runs the CPU-side prompt-lookup speculative-decoding acceptance simulator over three prompt types — see `src/zero-tvm/spec-sim.ts`.

## Models

**Phi-3-mini-4k-instruct (3.8B, q4f16_1) — the default.** Everything above —
the headline numbers, the kernel counts, the fusion story — is about Phi-3.
No URL flag needed; all existing URLs keep their exact behavior.

**Qwen3-4B (q4f16_1) — `?model=qwen3` on `zero-tvm.html` and
`validate.html`.** A v1 port that exercises the spec-parameterized engine on
a genuinely different architecture:

- **GQA 32/8** — 32 query heads over 8 KV heads (Phi-3 is 32/32 MHA), with
  `qDim = 4096 ≠ d = 2560`
- **QK-norm** — per-head RMSNorm on Q and K between the projection and RoPE
- **byte-level BPE tokenizer** (Qwen2-style `tokenizer.json`; Phi-3 is SPM)
- **tied lm_head** — logits reuse the quantized embedding matrix
- ChatML template, run in the non-thinking form (`<think>` rendering is not
  built)

Honest performance framing: the Qwen path is **v1-unfused** — QK-norm is
incompatible with the fused QKV+RoPE+KV-append kernel, so it runs the
unfused reference composition (10 dispatches/layer vs the Phi-3 chat path's
7), and the vec4-load matmuls only engage where K is a multiple of 1024
(o_proj's K=4096 qualifies; d=2560 and ffn=9728 do not). No int8-KV.
Measured same-session pair on an Apple M2 Max (2026-07-28, Chrome
150.0.7871.187, identical local weight bytes): Zero-TVM **25.4 tok/s**
decode vs WebLLM's prebuilt Qwen3-4B at **14.2 tok/s** — ~1.8× on that pair.
Read that gap cautiously: it is one pair on one machine, and both engines
run Qwen3-4B far below their Phi-3 rates here (62.9 → 25.4 for Zero-TVM,
47.9 → 14.2 for WebLLM), so it says as much about WebLLM's prebuilt Qwen3
lib on this GPU as about our port. Protocol and caveats in
[BENCH.md](BENCH.md).

Weights: `node scripts/download-weights.mjs --model qwen3` primes the local
dev mirror (~2.3 GB); without it the page streams from HuggingFace.

**Qwen3.5-4B (q4f16_1) — `?model=qwen35` on `zero-tvm.html` and
`validate.html`.** The third model, and the first *hybrid*: 24
gated-DeltaNet (linear-attention) layers interleaved with 8 gated
full-attention layers, running on the same hand-written kernels. To our
knowledge this is the first hand-written-kernel int4 implementation of a
gated-DeltaNet hybrid running in a browser. What it adds over Qwen3-4B:

- **hybrid layer stack** — attention on every 4th layer only; the other 24
  layers run gated DeltaNet: a recurrent delta-rule state update (16 k-heads,
  32 v-heads, head dims 128, short conv K=4), no KV cache on those layers
- **GQA 16/4 at head_dim 256** on the attention layers, with **partial RoPE**
  (only 64 of 256 dims rotate) and a **sigmoid output gate** per head
- **248,320-token vocab** with renumbered special tokens (the repo's shipped
  `mlc-chat-config.json` still lists the stale Qwen3 stop ids — we resolve
  stops from `tokenizer.json` instead), tied lm_head

Measured same-session pair on an Apple M2 Max (2026-07-28, Chrome
150.0.7871.187, identical local weight bytes): Zero-TVM **47.99 tok/s**
decode vs WebLLM 0.2.84's prebuilt Qwen3.5-4B at **31.99 tok/s** — +50% on
that pair. Same honest framing as always: one machine, one pair, and the
Zero-TVM path is **v1-scalar-GDN** — scalar (non-subgroup) DeltaNet kernels,
no chunked prefill (prompts replay token-by-token), unfused GDN projections
— so the number is a floor, not a tuned result. Protocol and caveats in
[BENCH.md](BENCH.md).

Weights: `node scripts/download-weights.mjs --model qwen35` primes the local
dev mirror (~2.6 GB); without it the page streams from HuggingFace.

## The repository as an argument

The directory layout is the narrative arc of the project. Each page is a milestone.

```
index.html              (landing page — essay, shader catalog, compare table)
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

## How it's tested

Three layers, intentionally separate:

1. **Per-shader correctness vs TVM** — `test-shaders.html` (`src/compiler/test-harness.ts`).
   Loads WebLLM, intercepts the WGSL device to capture every TVM dispatch from a real
   decode step, then runs each of our shaders against the matching TVM dispatch's
   input buffers and compares the f16/f32 output buffers element-wise (`cmpF16`/`cmpF32`).
   Each shader is reported with `maxDiff`, `avgDiff`, and exact-match percentage.
   Catches kernel-level bugs but only exercises one prompt.

2. **Live forward pass on diverse prompts** — `validate.html` (`src/zero-tvm/validate.ts`).
   Drives `engine-core.ts` (the reference path) against a battery of prompts
   (factual recall, arithmetic, code, instruction following, open-ended) through
   `forwardLogits` and reports for each: the top-10 next-token candidates with
   probabilities, the entropy of the predictive distribution, and a short greedy
   continuation. A reader can scroll through the page and verify the model behaves
   like Phi-3 on inputs that were never in the per-shader test set.

3. **Automated kernel correctness (headless, CI-ready)** — `npm run test:kernels`
   (`tests/kernels/`). Runs the real WGSL kernels from `src/compiler/shaders/`
   against independent CPU references — 8 of the 10 roles, exact or within f16
   tolerance. Uses the Dawn-native WebGPU binding on Mesa lavapipe, so it needs
   no GPU and runs in CI; on a machine with a GPU it uses the real adapter. This
   is the automated net the per-shader browser harness (layer 1) never had.

`zero-tvm.html` and `validate.html` share the same decode engine
(`engine-core.ts`); the chat page runs it in the fused / variant-selected /
pipelined configuration while validate runs the unfused scalar reference with
blocking per-token readback, so a validate pass exercises the same kernels,
buffers, and bind-group layout the chat page ships.

## Performance

Measured on Apple M2 Max, Chrome 150.0.7871.182, Phi-3-mini-4k-instruct q4f16_1,
steady-state decode, 128 tokens × 5 runs, median (latest run recorded in
`bench/results.json`; ratio stable −28…−31% across sessions):

| | tok/s (median) |
|---|---|
| Zero-TVM (this repo, f16 KV, default shaders) | **<!--bench:zt-->62.90<!--/bench:zt-->** |
| WebLLM v0.2.80 (MLC-LLM, same weights, same run) | **<!--bench:webllm-->47.9<!--/bench:webllm-->** |

Reproduce on any WebGPU GPU with `npm run bench` — it drives both engines on
identical weights and refreshes every marker-wrapped number (see below). It
also runs headless on a cloud GPU (Colab notebook + Docker image in
[`bench/`](bench/)) for machines without a local one.

### Keeping the numbers in sync

`bench/results.json` is the single source of truth. `npm run bench` writes it
and rewrites every marker-wrapped number (`<!--bench:zt/webllm/gap-->`) in
BENCH.md, README.md, index.html, and docs.html, plus the `// bench:zt` constant
in `src/webllm-bench/main.ts` — `npm run bench:sync -- --write` re-propagates
it without a GPU (see `bench/README.md`). Merging to `main` then auto-deploys
zerotvm.com (Cloudflare Pages) and mirrors the built site + Space card to the
[Hugging Face Space](https://huggingface.co/spaces/abgunaydin/zero-tvm) via
`.github/workflows/deploy-space.yml` (needs an `HF_TOKEN` repo secret; the job
skips with a notice if it's absent).

That's 28–31% faster than the autotuned compiler on an identical workload —
one machine, one model, one browser; the best measured opt-in config
(`?vec4=1&vec4qkv=1&splitk=8`) reaches 68.36 tok/s. An earlier M2 Pro
measurement with an older engine read 22% *behind*; both hardware and code
changed since, so the same-day WebLLM number is the only valid comparator
(details in BENCH.md). See [BENCH.md](BENCH.md) for the full protocol, the
raw numbers, and the optimization experiments that were *measured and dropped*:

- Three QKV tiling strategies (1152 WGs × 32 threads, 2304 × 32, 2304 × 64) — all
  regressed vs the 4608-WG subgroup baseline. Apple GPUs want high WG occupancy
  on this kernel; tiling reduces it.
- Prompt-lookup speculative decoding — CPU-simulated over three prompt types
  (prose, code, summary). Acceptance rate <8% at N=3, K=3; below the 67% threshold
  the `(1+αK)/((K+1)/2)` throughput formula needs to break even. Falsified before
  any shader was written (`src/zero-tvm/spec-sim.ts`).
- FFN prologue fusion (`?fuseprologue=1`) — folding addNorm1 into the FFN kernel
  to remove 32 dispatch bubbles per token measured **−13.7%** on M2 Max: the
  redundant per-workgroup RMSNorm recompute costs more than the dispatch
  bubbles save. Kept behind its flag for A/B on other GPUs.

## Known caveats

These are the caveats that survive the code as-shipped. Several earlier ones — silent context overflow, per-token uniform buffer leaks, double `queue.submit()`, redundant first-token readback — were turned into code fixes rather than documentation. The remaining items are either inherent to the approach or deliberate scoping decisions.

### Inherent

- **Phi-3-mini-4k-instruct Q4 only.** The model shape lives in one place — the `PHI3` object in `src/compiler/shader-prelude.ts` (`D=3072`, `HEADS=32`, `HEAD_DIM=96`, `LAYERS=32`, `FFN=8192`, `VOCAB=32064`, `PAGE_SIZE=16`, `MAX_PAGES=257`) — which is rendered as a WGSL `const` prelude and injected into every shader, so the address arithmetic uses named constants (`D`, `HEAD_DIM`, `KV_PAGE_STRIDE`, …) instead of magic literals. Porting to Mistral or Llama is still not just a config edit: the kernels bake in structural assumptions (MHA with no GQA, `HEAD_DIM = 32×3` thread partitioning in attention, `D` divisible by 256, RoPE pair layout), plus the tokenizer/template/loader items below.
- **GPU memory footprint ≈ 3.6 GB.** Phi-3-mini Q4 weights are ~1.8 GB, and the paged KV cache is `32 layers × 257 pages × 196,608 B/page ≈ 1.6 GB`. On an M2 Pro with 16 GB unified memory this is invisible; on a 4 GB integrated GPU it will OOM during KV allocation before the first token. If you want to trade context length for memory, lower `MAX_PAGES` in `src/compiler/compiler.ts` — 128 pages = 2048-token context, ~0.8 GB KV, which fits almost anywhere. The optional `?kv8=1` int8 KV path roughly halves the KV footprint.
- **Requires the `shader-f16` WebGPU feature.** Matmuls run in f16 (`enable f16` at the top of every int4 matmul variant). The LM head uses an f32 output buffer (the `int4_matmul_f32` generator variant) because the sampling pipeline needs f32 logits — TVM's `NT_matmul14_cast2` does the same cast. Chrome/Edge with WebGPU and `shader-f16` is required; Safari's WebGPU does not yet expose `shader-f16`.
- **BPE tokenizer is a hand-rolled reimplementation, not `tokenizers.js`.** `src/zero-tvm/tokenizer.ts` is ~280 lines: vocab lookup, merge table, metaspace prefixing, byte fallback, SentencePiece hex-byte decode. It does **not** implement HuggingFace's full pre-tokenization regex pipeline or Unicode NFKC normalization. For normal English chat it matches the reference tokenizer; for emoji, unusual Unicode, or some punctuation patterns it may diverge. If correctness matters for your input, run the prompt through `@huggingface/tokenizers` and compare.
- **Phi-3 chat template is baked in.** `buildChatPrompt` in `tokenizer.ts` emits `<|system|>...<|end|>\n<|user|>...<|end|>\n<|assistant|>\n`. Stop tokens are the Phi-3 set `{2, 32000, 32007}`. Port to another model → edit both.
- **Weight loader expects MLC's Q4f16_1 layout.** [`mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC`](https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC), including MLC's renamed parameter scheme (`transformer.h.N.mixer.*`, not `model.layers.N.*`). If MLC re-quantizes or re-names, the loader needs a patch.

### Deliberate scoping

- **Greedy decoding only.** Sampling is a single `argmax.wgsl` dispatch. No temperature, top-k, top-p, repetition penalty. A CPU-side sampler over the f32 logit buffer would be ~30 lines; left out to keep the minimal-stack claim honest.
- **Sequential prefill.** Each prompt token is run through the full decode path. Fine for chat-length prompts; the `int4_matmul_batched_m4` generator variant is the shader for a batched-prefill attention path but is not yet wired into the decode loop.
- **One decode engine, two configurations.** `engine-core.ts` is the single `buildDecodeEngine`; `validate.html` runs it unfused/scalar with blocking per-token readback (deterministic positions, logits access), `zero-tvm.html` runs it fused with URL-flag shader variants and the pipelined readback ring. The per-layer QKV stage and the readback style are the only mode-dependent parts.
- **Residual buffer ping-pong.** WebGPU forbids read+write to the same buffer in one dispatch, so the decode loops swap between `B.residual` and `B.residual2` across the `add_norm` dispatches. The two swaps per layer cancel out, which is why the per-layer bind groups can be pre-computed once and reused for every token.

## License

MIT. See [LICENSE](LICENSE).

## Citation

This repo ships a [`CITATION.cff`](CITATION.cff), so GitHub's "Cite this
repository" button renders APA / BibTeX automatically. Each release is archived
to [Zenodo](https://zenodo.org) — cite the concept DOI
[10.5281/zenodo.20838918](https://doi.org/10.5281/zenodo.20838918) for all
versions.

```
Gunaydin, A. B. (2026). Zero-TVM: Phi-3-mini in the browser on hand-written
WGSL kernels. https://zerotvm.com | https://github.com/abgnydn/zero-tvm
```
