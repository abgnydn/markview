<img width="1707" height="992" alt="image" src="https://github.com/user-attachments/assets/045c4815-3c6c-4c6b-b0d3-d227da7e2e96" />

# Zero-TVM

**[zerotvm.com](https://zerotvm.com)**

**Phi-3-mini running in a browser on hand-written WGSL shaders. No TVM. No WebLLM runtime. No compiler.**

The standard way to run a modern LLM in a browser is [WebLLM / MLC-LLM](https://webllm.mlc.ai/), which ships an Apache-TVM compiler pipeline that emits 85 autotuned WGSL kernels and drives them from a WASM scheduler. This repo replaces that entire stack with **10 kernel roles (27 WGSL implementations, counting subgroup/tiled/int8 variants) and about 2,000 lines of TypeScript** (engine + tokenizer + weight loader), using the same model and the same quantized weights.

The whole forward pass — 32 transformer layers, paged KV cache, int4-dequant matmul, RoPE, fused FFN, RMSNorm, paged attention, argmax sampling — is readable end-to-end in a single sitting. That is the point.

## What's actually in the box

All numbers below are measured from the source and the build output in this repo. Performance varies by GPU — throughput is displayed live in the chat UI. A head-to-head vs WebLLM on identical hardware/weights is recorded in [BENCH.md](BENCH.md).

| | WebLLM (TVM) | Zero-TVM (this repo) |
|---|---|---|
| Unique WGSL kernels | **85** | **10 roles / 27 files** |
| Total WGSL lines | **12,962** (generated) | **3,078** (hand-written, incl. A/B variants) |
| Dispatches per decode step | **342** | **228** (f16 KV) / **260** (int8 KV) |
| Runtime | TVM → WASM scheduler | Plain TypeScript, no runtime |
| Tokenizer | bundled from WebLLM | BPE from scratch (`tokenizer.ts`) |
| Weight loader | MLC's | Direct HuggingFace fetch + OPFS cache |
| JS bundle (chat page, excl. model weights) | **5.9 MB** / 2.1 MB gz (`compiler-chat.html`) | **157 kB** / 33 kB gz (`zero-tvm.html`) |

Zero-TVM issues **fewer** dispatches than TVM because it fuses operations TVM's default pipeline doesn't:

- `qkv_fused.wgsl` — Q/K/V projection + RoPE + paged-KV append, one dispatch per layer (was 3 in earlier revisions and in TVM's emission).
- `attention.wgsl` — paged attention combined with the page-table read.
- `fused_ffn.wgsl` — gate + up + SiLU in one pass.
- `add_norm.wgsl` — residual add + RMSNorm in one pass.

Every FLOP the model executes is in a file you can open. Every GPU buffer has a human label. Every dispatch is annotated in `src/zero-tvm/chat.ts` (the experimental path) and `src/zero-tvm/engine-core.ts` (the reference path).

## Why this might be interesting

Hand-written GPU kernels usually lose significantly to an autotuning compiler. The claim this repo is designed to test is: **for a decoder-only LLM of this shape, most of the compiler's complexity budget isn't buying much.** The expensive parts are matmul, attention, and int4 dequant. Everything else is plumbing. ~10 kernels of plumbing, instead of 85.

Measured result on an M2 Pro (WebGPU + `shader-f16`, identical Phi-3-mini-q4f16_1 weights): ~40 tok/s decode vs WebLLM's ~51 tok/s — **about 22% behind the autotuned compiler**. Full methodology and A/B results in [BENCH.md](BENCH.md), including three tile-variant experiments and a prompt-lookup speculative-decoding experiment that were *falsified* by measurement rather than shipped.

That the gap is 22% and not 2× is the interesting fact. The repo makes the stack *auditable*: if you want to instrument a layer, add a new fusion, test a different attention pattern, or teach someone how browser LLM inference works at the metal, there is no compiler in the way — just WGSL and a few hundred lines of TypeScript orchestrating it.

The closest reference point is Karpathy's [llm.c](https://github.com/karpathy/llm.c) (hand-written CUDA/C GPT-2). This is that thesis — *you don't need the giant framework* — ported to browser / WebGPU / int4 / paged KV / modern arch, for a model people actually use.

## How to run

**Requirements:** A recent Chrome or Edge with WebGPU enabled and the `shader-f16` feature available. Tested on macOS (M2 Pro, Chrome 120+). Other platforms should work but are untested.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/zero-tvm.html>. On first load the browser downloads the Phi-3-mini-4k-instruct Q4 weights from HuggingFace (~1.8 GB) and caches them in OPFS (Origin Private File System). Subsequent loads are instant.

To build a deployable bundle:

```bash
npm run build   # → dist/
```

The build produces a multi-page Vite output: `index.html` (landing page — project overview, shader catalog, compare table), `zero-tvm.html` (chat demo), `compiler-chat.html`, `demo.html` (dispatch visualization), `validate.html` (multi-prompt smoke test), `webllm-bench.html` (head-to-head harness), `architecture.html`, `docs.html`.

### URL flags

`zero-tvm.html` accepts a handful of query flags for A/B-ing shader variants without rebuilding. Defaults are tuned for Apple GPUs; flags let you isolate a path:

- `?sg=0` — disable all subgroup shaders (argmax / attention / QKV matmul)
- `?sgqkv=0` / `?sgattn=0` / `?sgargmax=0` — disable one at a time
- `?qkvtile=1` / `?qkvtile2=1` — opt into tiled QKV variants (both regressed on M2 Pro — kept for portability testing)
- `?ffnsg=1` — opt into the tiled-subgroup fused FFN
- `?kv8=1` — opt into the int8 KV cache path (`kv_quantize_int8` + `attention_int8`)

Open DevTools and `window.specSim(160, 3, 3)` runs the CPU-side prompt-lookup speculative-decoding acceptance simulator over three prompt types — see `src/zero-tvm/spec-sim.ts`.

## The repository as an argument

The directory layout is the narrative arc of the project. Each page is a milestone.

```
index.html              → src/main.ts              (1) Baseline: WebLLM, untouched
compiler-chat.html      → src/compiler/chat-v2.ts  (2) Intermediate: WebLLM captures
                                                       dispatches, our shaders replay
                                                       279 of 342 of them
zero-tvm.html           → src/zero-tvm/chat.ts     (3) The result: all dispatches
                                                       replaced, WebLLM never touched
validate.html           → src/zero-tvm/validate.ts Multi-prompt smoke test driving
                                                       src/zero-tvm/engine-core.ts
webllm-bench.html       → src/webllm-bench/main.ts (4) Honesty check: WebLLM driven
                                                       against the same local weights
                                                       for a fair head-to-head

demo.html               → src/demo.ts              Dispatch timeline visualization
dump.html               → src/dump-tvm.ts          Captures all 85 TVM-emitted WGSL
shaders.html            → src/dump-shaders.ts      Browses the captured shaders
test-shaders.html       → src/compiler/test-harness.ts  Per-shader correctness vs TVM
test-chain.html         → src/compiler/test-chain.ts
standalone-test.html    → src/standalone-test.ts
```

```
src/
  zero-tvm/             THE RESULT
    engine-core.ts        ~450 lines — pure GPU pipeline: buildDecodeEngine,
                          allocKVPages, the 32-layer decode loop. No DOM.
                          Used by validate.ts (and by chat.ts's ancestor before
                          the progressive-streaming refactor).
    chat.ts               ~1,100 lines — the experimental path: progressive
                          weight streaming with OPFS cache, fused QKV+RoPE+KV
                          dispatch, opt-in int8 KV cache, URL-flag A/B harness.
                          Currently a monolith rather than a thin UI on top of
                          engine-core.ts; unifying the two is on the roadmap.
    spec-sim.ts           120 lines — CPU-side prompt-lookup speculative-decoding
                          acceptance simulator. Used to falsify a speed-up
                          experiment before building shaders.
    tokenizer.ts          ~280 lines — BPE tokenizer from scratch
    weight-loader.ts      ~300 lines — direct HuggingFace Phi-3-MLC fetch,
                          OPFS cache, layer-ordered streaming
    validate.ts           ~320 lines — multi-prompt forward-pass smoke test
    loading-ui.ts         ~180 lines — shared progress-bar UI for validate

  webllm-bench/
    main.ts               Head-to-head harness: WebLLM v0.2.80 wired against
                          /local-weights/* so the comparison runs on identical
                          bits. See BENCH.md.

  compiler/             THE SHADERS
    compiler.ts           ~280 lines — pipeline creation, PHI3 model constants,
                          weight buffer allocation. Not an optimizing compiler —
                          the name is historical.
    shaders/              27 hand-written WGSL files, 3,078 lines total:
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
      int4_matmul.wgsl           OProj / FFN-down baseline
      int4_matmul_sg.wgsl        subgroup-reduce variant
      int4_matmul_tiled.wgsl     tiled variant (rows×4)
      int4_matmul_tiled8.wgsl    tiled variant (rows×8)
      int4_matmul_f32.wgsl       LM head (f32 output for stable argmax)
      int4_matmul_f32_sg.wgsl    LM head, subgroup variant
      int4_matmul_f32_tiled.wgsl
      int4_matmul_f32_tiled8.wgsl
      int4_matmul_batched_m4.wgsl  M=4 batched path (for batched-prefill experiments)
      argmax.wgsl
      argmax_sg.wgsl             subgroup variant

  tvm-shaders/          THE EVIDENCE — all 85 TVM-emitted WGSL kernels,
                        captured from a running WebLLM session by
                        src/dump-tvm.ts. Keep this next to compiler/shaders/
                        and the replacement is auditable.
```

`RESEARCH.md` is the writeup of how the shader capture worked and what reading TVM's output revealed about its kernel set. `BENCH.md` records the measured numbers, the head-to-head methodology, and the experiments that were falsified rather than shipped.

## How it's tested

Two layers, intentionally separate:

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

`zero-tvm.html` currently runs a parallel decode implementation in `chat.ts` with
the progressive-streaming / fused-QKV / int8-KV work layered on top. Its correctness
is covered by the per-shader tests (same kernels) and by the subjective chat UX,
but it doesn't yet share `engine-core.ts` with `validate.html`. Unifying them is
tracked as technical debt rather than hidden.

## Performance

Measured on M2 Pro, Chrome 120+, Phi-3-mini-4k-instruct q4f16_1, steady-state decode:

| | tok/s (median) |
|---|---|
| WebLLM v0.2.80 (MLC-LLM, same weights) | **~51** |
| Zero-TVM (this repo, f16 KV, default shaders) | **~40** |

That's ~22% behind the autotuned compiler on an identical workload. See
[BENCH.md](BENCH.md) for the full protocol, the raw numbers, and three optimization
experiments that were *measured and dropped*:

- Three QKV tiling strategies (1152 WGs × 32 threads, 2304 × 32, 2304 × 64) — all
  regressed vs the 4608-WG subgroup baseline. Apple GPUs want high WG occupancy
  on this kernel; tiling reduces it.
- Prompt-lookup speculative decoding — CPU-simulated over three prompt types
  (prose, code, summary). Acceptance rate <8% at N=3, K=3; below the 67% threshold
  the `(1+αK)/((K+1)/2)` throughput formula needs to break even. Falsified before
  any shader was written (`src/zero-tvm/spec-sim.ts`).

## Known caveats

These are the caveats that survive the code as-shipped. Several earlier ones — silent context overflow, per-token uniform buffer leaks, double `queue.submit()`, redundant first-token readback — were turned into code fixes rather than documentation. The remaining items are either inherent to the approach or deliberate scoping decisions.

### Inherent

- **Phi-3-mini-4k-instruct Q4 only, by shader surgery.** The constants in `src/compiler/compiler.ts` declare `D=3072`, `HEADS=32`, `HEAD_DIM=96`, `LAYERS=32`, `FFN=8192`, `VOCAB=32064`, `PAGE_SIZE=16`, `MAX_PAGES=257` — but those values are **also hard-coded as integer literals in address arithmetic inside most of the shaders** (`grep '3072\|9216\|98304\|1536\|8192' src/compiler/shaders/`). Porting to Mistral, Llama, or any other architecture is not a config edit; it is a per-shader rewrite of offsets and strides.
- **GPU memory footprint ≈ 3.6 GB.** Phi-3-mini Q4 weights are ~1.8 GB, and the paged KV cache is `32 layers × 257 pages × 196,608 B/page ≈ 1.6 GB`. On an M2 Pro with 16 GB unified memory this is invisible; on a 4 GB integrated GPU it will OOM during KV allocation before the first token. If you want to trade context length for memory, lower `MAX_PAGES` in `src/compiler/compiler.ts` — 128 pages = 2048-token context, ~0.8 GB KV, which fits almost anywhere. The optional `?kv8=1` int8 KV path roughly halves the KV footprint.
- **Requires the `shader-f16` WebGPU feature.** Matmuls run in f16 (see `enable f16` at the top of every `int4_matmul*.wgsl`). The LM head uses an f32 output buffer (`int4_matmul_f32.wgsl`) because the sampling pipeline needs f32 logits — TVM's `NT_matmul14_cast2` does the same cast. Chrome/Edge with WebGPU and `shader-f16` is required; Safari's WebGPU does not yet expose `shader-f16`.
- **BPE tokenizer is a hand-rolled reimplementation, not `tokenizers.js`.** `src/zero-tvm/tokenizer.ts` is ~280 lines: vocab lookup, merge table, metaspace prefixing, byte fallback, SentencePiece hex-byte decode. It does **not** implement HuggingFace's full pre-tokenization regex pipeline or Unicode NFKC normalization. For normal English chat it matches the reference tokenizer; for emoji, unusual Unicode, or some punctuation patterns it may diverge. If correctness matters for your input, run the prompt through `@huggingface/tokenizers` and compare.
- **Phi-3 chat template is baked in.** `buildChatPrompt` in `tokenizer.ts` emits `<|system|>...<|end|>\n<|user|>...<|end|>\n<|assistant|>\n`. Stop tokens are the Phi-3 set `{2, 32000, 32007}`. Port to another model → edit both.
- **Weight loader expects MLC's Q4f16_1 layout.** [`mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC`](https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC), including MLC's renamed parameter scheme (`transformer.h.N.mixer.*`, not `model.layers.N.*`). If MLC re-quantizes or re-names, the loader needs a patch.

### Deliberate scoping

- **Greedy decoding only.** Sampling is a single `argmax.wgsl` dispatch. No temperature, top-k, top-p, repetition penalty. A CPU-side sampler over the f32 logit buffer would be ~30 lines; left out to keep the minimal-stack claim honest.
- **Sequential prefill.** Each prompt token is run through the full decode path. Fine for chat-length prompts; `int4_matmul_batched_m4.wgsl` is the shader for a batched-prefill attention path but is not yet wired into the decode loop.
- **Two decode implementations.** `engine-core.ts` is the reference (used by `validate.html`); `chat.ts` is the experimental monolith with the progressive-streaming / fused-QKV / int8-KV work (used by `zero-tvm.html`). Both correct, not yet unified.
- **Residual buffer ping-pong.** WebGPU forbids read+write to the same buffer in one dispatch, so the decode loops swap between `B.residual` and `B.residual2` across the `add_norm` dispatches. The two swaps per layer cancel out, which is why the per-layer bind groups can be pre-computed once and reused for every token.

## License

MIT. See [LICENSE](LICENSE).

## Citation

If this repo is useful to your research or writing, cite it as:

```
Gunaydin, A. B. (2026). Zero-TVM: Phi-3 in a browser on hand-written WGSL shaders.
https://zerotvm.com | https://github.com/abgnydn/zero-tvm
```
