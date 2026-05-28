<img width="1707" height="992" alt="image" src="https://github.com/user-attachments/assets/045c4815-3c6c-4c6b-b0d3-d227da7e2e96" />

# Zero-TVM

**[zerotvm.com](https://zerotvm.com)**

**Phi-3-mini running in a browser on 10 hand-written WGSL shaders. No TVM. No WebLLM runtime. No compiler.**

The standard way to run a modern LLM in a browser is [WebLLM / MLC-LLM](https://webllm.mlc.ai/), which ships an Apache-TVM compiler pipeline that emits 85 autotuned WGSL kernels and drives them from a WASM scheduler. This repo replaces that entire stack with **10 WGSL compute shaders and about 1,400 lines of TypeScript** (engine + tokenizer + weight loader), using the same model and the same quantized weights.

The whole forward pass — 32 transformer layers, paged KV cache, int4-dequant matmul, RoPE, fused FFN, RMSNorm, attention, argmax sampling — is readable end-to-end in a single sitting. That is the point.

## What's actually in the box

All numbers below are measured from the source and the build output in this repo. Performance varies by GPU — throughput is displayed live in the chat UI.

| | WebLLM (TVM) | Zero-TVM (this repo) |
|---|---|---|
| Unique WGSL shaders | **85** | **10** |
| Total WGSL lines | **12,962** (generated) | **792** (hand-written) |
| Dispatches per forward pass | **342** | **292** (–50 via fusion) |
| Runtime | TVM → WASM scheduler | Plain TypeScript, no runtime |
| Tokenizer | bundled from WebLLM | BPE from scratch (`tokenizer.ts`) |
| Weight loader | MLC's | Direct HuggingFace fetch |
| JS bundle (chat page, excl. model weights) | **5.9 MB** / 2.1 MB gz (`compiler-chat.html`) | **49 kB** / 14 kB gz (`zero-tvm.html`) |

Zero-TVM issues **fewer** dispatches than TVM because it fuses operations TVM's default pipeline doesn't: `attention.wgsl` combines attention + paged-KV read, `fused_ffn.wgsl` combines gate + up + SiLU, `add_norm.wgsl` combines residual add + RMSNorm.

Every FLOP the model executes is in a file you can open. Every GPU buffer has a human label. Every dispatch in `src/zero-tvm/chat.ts` has a numbered comment explaining what it does.

## Why this might be interesting

Hand-written GPU kernels usually lose significantly to an autotuning compiler. The claim this repo is designed to test is: **for a decoder-only LLM of this shape, most of the compiler's complexity budget isn't buying much.** The expensive parts are matmul, attention, and int4 dequant. Everything else is plumbing. 10 shaders of plumbing, instead of 85.

Whether that's true in practice is an empirical question — the shader count and bundle size are objectively smaller, and you can measure end-to-end throughput on your own hardware directly in the chat UI.

It also makes the stack *auditable*. If you want to instrument a layer, add a new fusion, test a different attention pattern, or teach someone how browser LLM inference works at the metal, there is no compiler in the way — just 792 lines of WGSL and ~450 lines of TypeScript in `src/zero-tvm/engine-core.ts` orchestrating them (the 32-layer decode loop, residual ping-pong, and per-layer bind-group caching all live in one file).

The closest reference point is Karpathy's [llm.c](https://github.com/karpathy/llm.c) (hand-written CUDA/C GPT-2). This is that thesis — *you don't need the giant framework* — ported to browser / WebGPU / int4 / paged KV / modern arch, for a model people actually use.

## How to run

**Requirements:** A recent Chrome or Edge with WebGPU enabled and the `shader-f16` feature available. Tested on macOS (M2 Pro, Chrome 120+). Other platforms should work but are untested.

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/zero-tvm.html>. On first load the browser downloads the Phi-3-mini-4k-instruct Q4 weights from HuggingFace (several hundred MB) and caches them in the browser's storage. Subsequent loads are instant.

To build a deployable bundle:

```bash
npm run build   # → dist/
```

The build produces a multi-page Vite output with all demo pages (`index.html`, `compiler-chat.html`, `zero-tvm.html`, `dump.html`, `demo.html`, tests).

## The repository as an argument

The directory layout is the narrative arc of the project. Each page is a milestone.

```
index.html              → src/main.ts              (1) Baseline: WebLLM, untouched
compiler-chat.html      → src/compiler/chat-v2.ts  (2) Intermediate: WebLLM captures
                                                       dispatches, our shaders replay
                                                       279 of 342 of them
zero-tvm.html           → src/zero-tvm/chat.ts     (3) The result: all 342 replaced,
                                                       WebLLM never touched

dump.html               → src/dump-tvm.ts          Captures all 85 TVM-emitted WGSL
shaders.html            → src/dump-shaders.ts      Browses the captured shaders
demo.html               → src/demo.ts              Dispatch timeline visualization
test-shaders.html       → src/compiler/test-harness.ts  Per-shader correctness vs TVM
test-chain.html         → src/compiler/test-chain.ts
standalone-test.html    → src/standalone-test.ts
validate.html           → src/zero-tvm/validate.ts Multi-prompt forward-pass smoke
                                                       test (top-10 next tokens +
                                                       greedy continuation per prompt)
```

```
src/
  zero-tvm/             THE RESULT
    engine-core.ts        ~430 lines — pure GPU pipeline: buildDecodeEngine,
                          allocKVPages, the 32-layer decode loop. No DOM.
                          Imported by chat.ts AND validate.ts so the chat path
                          and the validation harness exercise the same code.
    chat.ts               ~280 lines — chat UI + multi-turn KV-cache reuse
                          (skips re-prefilling unchanged conversation prefixes).
    validate.ts           ~290 lines — multi-prompt forward-pass smoke test.
    tokenizer.ts          248 lines — BPE tokenizer from scratch
    weight-loader.ts      318 lines — direct HuggingFace Phi-3-MLC fetch + parse

  compiler/             THE 10 SHADERS
    compiler.ts           225 lines — pipeline creation, PHI3 model constants,
                          weight buffer allocation. Not an optimizing compiler —
                          the name is historical.
    shaders/              10 hand-written WGSL files, 792 lines total:
      int4_matmul.wgsl         Used by QKV, OProj, and FFN-down matmuls
      int4_matmul_f32.wgsl     LM head (f32 output for stable argmax)
      rms_norm.wgsl
      add_norm.wgsl            Fused residual add + RMSNorm
      rope.wgsl                Splits fused QKV and applies rotary
      kv_append.wgsl           Writes into paged KV cache
      attention.wgsl           Paged attention (vLLM-style page table)
      fused_ffn.wgsl           Gate + up + SiLU, fused
      embedding.wgsl
      argmax.wgsl

  tvm-shaders/          THE EVIDENCE — all 85 TVM-emitted WGSL kernels,
                        captured from a running WebLLM session by
                        src/dump-tvm.ts. Keep this next to compiler/shaders/
                        and the replacement is auditable.
```

`RESEARCH.md` is a writeup of how the shader capture worked and what reading TVM's output revealed about its kernel set. `SHADER-ANALYSIS.md` is currently a placeholder for per-shader notes and is not yet populated.

## How it's tested

Two layers, intentionally separate:

1. **Per-shader correctness vs TVM** — `test-shaders.html` (`src/compiler/test-harness.ts`).
   Loads WebLLM, intercepts the WGSL device to capture every TVM dispatch from a real
   decode step, then runs each of our 10 shaders against the matching TVM dispatch's
   input buffers and compares the f16/f32 output buffers element-wise (`cmpF16`/`cmpF32`).
   Each shader is reported with `maxDiff`, `avgDiff`, and exact-match percentage.
   Catches kernel-level bugs but only exercises one prompt.

2. **Live forward pass on diverse prompts** — `validate.html` (`src/zero-tvm/validate.ts`).
   Drives the same `engine-core.ts` that the chat page uses, but instead of streaming
   tokens to a UI it runs a battery of prompts (factual recall, arithmetic, code, instruction
   following, open-ended) through `forwardLogits` and reports for each:
   the top-10 next-token candidates with probabilities, the entropy of the predictive
   distribution, and a short greedy continuation. A reader can scroll through the page
   and verify the model behaves like Phi-3 on inputs that were never in the per-shader
   test set. This is the smoke test that catches "the kernels pass in isolation but the
   pipeline overfits the one prompt I memorized."

Because both pages import `src/zero-tvm/engine-core.ts`, anything that drifts between
them is impossible by construction — there is one decode loop, exercised two ways.

## Known caveats

These are the caveats that survive the code as-shipped. Several earlier ones — silent context overflow, per-token uniform buffer leaks, double `queue.submit()`, redundant first-token readback — were turned into code fixes rather than documentation. The remaining items are either inherent to the approach or deliberate scoping decisions.

### Inherent

- **Phi-3-mini-4k-instruct Q4 only, by shader surgery.** The constants in `src/compiler/compiler.ts` declare `D=3072`, `HEADS=32`, `HEAD_DIM=96`, `LAYERS=32`, `FFN=8192`, `VOCAB=32064`, `PAGE_SIZE=16`, `MAX_PAGES=257` — but those values are **also hard-coded as integer literals in address arithmetic inside eight of the ten shaders** (`grep '3072\|9216\|98304\|1536\|8192' src/compiler/shaders/`). Porting to Mistral, Llama, or any other architecture is not a config edit; it is a per-shader rewrite of offsets and strides.
- **GPU memory footprint ≈ 3.6 GB.** Phi-3-mini Q4 weights are ~1.8 GB, and the paged KV cache is `32 layers × 257 pages × 196,608 B/page ≈ 1.6 GB` (see `allocKVPages` in `engine-core.ts`). On an M2 Pro with 16 GB unified memory this is invisible; on a 4 GB integrated GPU it will OOM during KV allocation before the first token. If you want to trade context length for memory, lower `MAX_PAGES` in `src/compiler/compiler.ts` — 128 pages = 2048-token context, ~0.8 GB KV, which fits almost anywhere.
- **Requires the `shader-f16` WebGPU feature.** Matmuls run in f16 (see `enable f16` at the top of every `int4_matmul*.wgsl`). The LM head uses an f32 output buffer (`int4_matmul_f32.wgsl`) because "the sampling pipeline needs f32 logits" — TVM's `NT_matmul14_cast2` does the same cast. Chrome/Edge with WebGPU and `shader-f16` is required; Safari's WebGPU does not yet expose `shader-f16`.
- **BPE tokenizer is a hand-rolled reimplementation, not `tokenizers.js`.** `src/zero-tvm/tokenizer.ts` is ~250 lines: vocab lookup, merge table, metaspace prefixing, byte fallback. It does **not** implement HuggingFace's full pre-tokenization regex pipeline or Unicode NFKC normalization. For normal English chat it matches the reference tokenizer; for emoji, unusual Unicode, or some punctuation patterns it may diverge, and the resulting token stream won't be exactly what Phi-3 was trained on. If correctness matters for your input, run the prompt through `@huggingface/tokenizers` and compare.
- **Phi-3 chat template is baked in.** `buildChatPrompt` in `tokenizer.ts` emits `<|system|>...<|end|>\n<|user|>...<|end|>\n<|assistant|>\n`. Stop tokens are the Phi-3 set `{2, 32000, 32007}`. Port to another model → edit both.
- **Weight loader expects MLC's Q4f16_1 layout.** [`mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC`](https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC), including MLC's renamed parameter scheme (`transformer.h.N.mixer.*`, not `model.layers.N.*`). If MLC re-quantizes or re-names, the loader needs a patch.

### Deliberate scoping

- **Greedy decoding only.** Sampling is a single `argmax.wgsl` dispatch. No temperature, top-k, top-p, repetition penalty. A CPU-side sampler over the f32 logit buffer would be ~30 lines; left out to keep the minimal-stack claim honest.
- **Sequential prefill.** Each prompt token is run through the full decode path. Fine for chat-length prompts; a batched-prefill attention shader would be a meaningful speedup for long-context ingest.
- **Residual buffer ping-pong.** WebGPU forbids read+write to the same buffer in one dispatch, so `engine-core.ts` swaps between `B.residual` and `B.residual2` across the `add_norm` dispatches. This isn't a bug or a workaround in the pejorative sense — it's how WebGPU requires you to write this — but it's the kind of thing a reader will notice and want explained. The two swaps per layer cancel out, which is why the per-layer bind groups can be pre-computed once and reused for every token. See the `LayerBG` block in `src/zero-tvm/engine-core.ts`.

## BitNet b1.58 2B4T + LoRA fine-tuning (bonus demo)

`bitnet.html` is a separate track that's not about the 10-shader thesis above. It's the **first public browser demo of LoRA fine-tuning a ternary 1.58-bit BitNet LLM on real pretrained weights** (as of April 2026 — see [RESEARCH.md](RESEARCH.md) for the prior-art survey).

The approach is honest about what it reuses. Inference — tokenizer, GGUF I2_S loading, WebGPU forward pass — runs on [0xbitnet](https://github.com/0xbitnet/0xbitnet) (MIT, v0.5.2). What's new here is the CPU LoRA adapter bolted onto the LM head and the end-to-end demo UX:

- Click **Load** → 2.4 GB GGUF streams from HuggingFace, ternary weights land on the GPU.
- Click **Generate** → GPU decode, CPU LoRA delta applied to logits, top-K sampling.
- Click **Fine-tune** → teacher-forced cross-entropy on (prompt, target) pairs, Adam on LoRA's A and B matrices; base model stays frozen on GPU.
- Click **Save .flora** → rank-16 adapter serialized as ~4 MB f16 blob, portable across devices.

### Architecture (one paragraph)

The LM head is a 2560 × 128256 tied embedding. A rank-16 LoRA there adds ~2.09 M trainable params — small enough to train and Adam-update in JavaScript without breaking a sweat. The one bridge between 0xbitnet's GPU code and our CPU LoRA is the post-final-norm hidden state `h ∈ R^2560` for the last token, which 0xbitnet normally consumes internally. A minimal patch (6 lines) to `node_modules/0xbitnet/dist/index.js` adds an optional `__captureNormed` readback buffer that copies `h` out each forward call. That one-copy patch is the total surgery required on 0xbitnet's ~2 K-line engine; it's checked in as `patches/0xbitnet+0.5.2.patch` and re-applied automatically via `patch-package`.

### Files

```
src/zero-tvm/
  bitnet-demo.ts          ~280 lines — page controller, forward-with-LoRA, sampling,
                                       generate loop, train loop, save/load adapter
  lora-adapter.ts         ~220 lines — LoRAState, addLoRADelta, stepLoRA (Adam),
                                       serializeLoRA / deserializeLoRA (.flora format)
patches/0xbitnet+0.5.2.patch           6-line normed-hidden-state readback hook
bitnet.html                            demo page
```

### .flora adapter format

```
bytes 0..3   : magic "FLRA"
bytes 4..7   : version = 1 (u32 LE)
bytes 8..11  : rank                (u32 LE, = 16)
bytes 12..15 : hidden dim D        (u32 LE, = 2560)
bytes 16..19 : vocab V             (u32 LE, = 128256)
bytes 20..23 : optimizer step      (u32 LE)
bytes 24..31 : reserved (0)
bytes 32..   : A as f16 (R·D elements), then B as f16 (V·R elements)
```

Total size: 32 + 2·(R·D + V·R) bytes ≈ **3.99 MB** at rank 16. Portable across machines; load re-zeros the Adam optimizer state.

### Running it

Requires a Chrome/Edge with WebGPU enabled and enough VRAM to hold the 1.6 GB of ternary weights + activations.

```bash
npm install                         # also runs patch-package via postinstall
npm run dev
# open http://localhost:5173/bitnet.html
```

First load streams the 2.4 GB GGUF from HuggingFace ([`microsoft/bitnet-b1.58-2B-4T-gguf`](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T-gguf), file `ggml-model-i2_s.gguf`) and caches it in the browser. Fine-tune step latency on an M-series laptop: ~44 ms GPU forward + ~42 ms CPU Adam step ≈ **86 ms/step**. A 50-step training run completes in ~17 s.

### Honest caveats

- **Inference is 0xbitnet, not hand-written.** The Phi-3/Zero-TVM thesis above (10 hand-written shaders, no runtime) does not apply here. BitNet inference goes through 0xbitnet's ~2 K-line WebGPU engine, which is the only practical way to run a ternary 2 B-param LLM in a browser today.
- **LoRA is on the LM head only.** Adapting attention or FFN blocks would require additional hidden-state readbacks per layer and a much larger CPU optimizer; keeping the adapter on the tied-embedding LM head is what makes the 4 MB adapter + CPU-only training budget work.
- **Training step hitches the UI for ~86 ms.** A GPU-side Adam kernel would eliminate that, but it isn't wired up — the current latency is already below the 200 ms UI-hitch perception threshold on the reference machine.

## License

MIT. See [LICENSE](LICENSE).

## Citation

If this repo is useful to your research or writing, cite it as:

```
Gunaydin, A. B. (2026). Zero-TVM: Phi-3 in a browser on 10 WGSL shaders.
https://zerotvm.com | https://github.com/abgnydn/zero-tvm
```
