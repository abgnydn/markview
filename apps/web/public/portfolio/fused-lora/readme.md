# fused-lora

**[fused-lora.pages.dev](https://fused-lora.pages.dev)** · **[abgnydn/fused-lora](https://github.com/abgnydn/fused-lora)**

**Browser-native LoRA fine-tuning of [BitNet b1.58 2B4T](https://huggingface.co/microsoft/bitnet-b1.58-2B-4T) — the first public demo of training a natively-trained ternary 2B LLM in a web page.**

- Forward pass on the GPU via [0xbitnet](https://github.com/0xbitnet/0xbitnet)'s ternary engine (one 6-line patch exposes the post-final-norm hidden state).
- Rank-16 LoRA on the tied LM head, ~2.09 M trainable params, ~4 MB `.flora` adapter.
- Adam in JavaScript on the CPU side. ~86 ms per step on Apple M2 Pro — 50-step run in ~17 s.
- `.flora` adapters pruned FLASC-style (10 % magnitude keep on `B`) compress to **200–400 KB** for federated sharing.

> This repo also ships the complete [zero-tvm](https://github.com/abgnydn/zero-tvm) Phi-3 stack — Phi-3 was the working reference demo before the BitNet pivot. See [`bitnet.html`](./bitnet.html) for the BitNet demo and [`zero-tvm.html`](./zero-tvm.html) for the original Phi-3 chat.

## The bridge between GPU inference and CPU LoRA

The LM head is a `2560 × 128256` tied embedding. A rank-16 LoRA there adds ~2.09 M trainable params — small enough to train and Adam-update in JavaScript without breaking a sweat.

The bridge between 0xbitnet's GPU inference and the CPU LoRA is the post-final-norm hidden state `h ∈ ℝ^2560` for the last token, which 0xbitnet normally consumes internally. A 6-line patch (`patches/0xbitnet+0.5.2.patch`, auto-applied by `patch-package`) adds an optional `__captureNormed` readback buffer that copies `h` out each forward call. **That's the entire surgery.**

## The demo loop (bitnet.html)

1. **Load** → 2.4 GB GGUF streams from HuggingFace (`microsoft/bitnet-b1.58-2B-4T-gguf`, `ggml-model-i2_s.gguf`). Ternary weights land on the GPU; the browser cache keeps them for the next visit.
2. **Generate** → GPU decode → CPU LoRA delta on logits → top-K sampling.
3. **Fine-tune** → teacher-forced cross-entropy on `(prompt, target)` pairs. Adam on the LoRA `A` and `B` matrices; base model stays frozen on the GPU.
4. **Save .flora** → rank-16 adapter serialized as a ~4 MB f16 blob.

## Architecture comparison (Phi-3 vs BitNet 2B4T)

| Field | Phi-3-mini | BitNet 2B4T | Porter action |
|---|---|---|---|
| `D` | 3072 | 2560 | constants |
| Layers | 32 | 30 | constants |
| Q heads | 32 | 20 | constants |
| KV heads | 32 (MHA) | 5 (GQA 4:1) | **new attention shader (GQA)** |
| Head dim | 96 | 128 | constants |
| FFN | 8192 | 6912 | constants |
| Activation | SwiGLU | **ReLU²** | **new FFN shader (no gate path)** |
| Vocab | 32064 | 128256 | constants; bigger LM head |
| Tied embed | no | **yes** | LM head reads input embedding |
| RoPE θ | 10000 | 500000 | constants |
| Weights | int4 | **ternary** | **rewrite matmul for ternary** |
| Activations | f16 | f16 (V0) / int8 (later) | reuse f16 path |

See [`BITNET_PORT.md`](./BITNET_PORT.md) for full porter notes.

## Why pivot from Gemma 3/4 to BitNet

Three candidates considered for the in-browser-trainable model:

1. **Gemma 4 E2B** (April 2026) — frontier quality, but multimodal MoE, ~80 h WGSL work.
2. **Gemma 3 270M** (Aug 2025) — easy-ish port, ~40 h, but is *another fp16/int4 model among many*.
3. **BitNet b1.58 2B4T** (April 2025, MIT) — ~40 h, and the only model that gives the project its identity:
   - Zero fp multiplies in projection layers — real, not aspirational: `{−1, 0, +1}` × one f16 scale per matrix.
   - 400 MB memory footprint at 2B params.
   - Microsoft explicitly says *"use bitnet.cpp on CPU."* No browser runtime exists today.

The Gemma path lands at *another browser inference engine*. The BitNet path lands at **the browser runtime for ternary LLMs, with in-browser fine-tuning.**

## Generic LoRA primitives (reusable beyond BitNet)

The WGSL shaders under `src/compiler/shaders/` are **generic, not BitNet-specific**:

- `lora_down.wgsl` — `temp[r] = Σ_k input[k] · A[r,k]` for arbitrary `K, RANK`.
- `lora_up.wgsl` — `output[m] += scale · Σ_r temp[r] · B[m,r]` for arbitrary `M, RANK`.
- `adam_lora.wgsl` — in-place AdamW on f16 params with f32 momentum, 64-thread workgroups, bias-correction uniforms.
- Backward kernels (`lora_*_bwd_*.wgsl`) — same pattern.

The BitNet-specific pieces live in TypeScript (`lora-adapter.ts` is hard-coded to `HIDDEN_D=2560, VOCAB_V=128256` and a next-token cross-entropy loss). For a different model (e.g. ViT-base with `D=768` + regression loss in [iz](https://github.com/abgnydn/iz)), the TS driver is rewritten while the shaders are kept.

## `.flora` v1 spec

```
bytes 0..3   : magic "FLRA"
bytes 4..7   : version u32 LE = 1
bytes 8..11  : rank   u32 LE
bytes 12..15 : D      u32 LE
bytes 16..19 : V      u32 LE
bytes 20..23 : step   u32 LE
bytes 24..31 : reserved (0)
bytes 32..   : A as f16 (R·D), then B as f16 (V·R)
```

At rank 16: ~4.18 MB on disk. For multi-layer adapters (e.g. LoRA on q/k/v/o + FFN across all ViT blocks), `.flora` v2 needs a list of `(layer_name, A, B)` tuples — not yet implemented.

### FLASC-style pruned `.flora`

`serializeLoRAPruned` ships federated-communication-efficient adapters: 10 % magnitude keep on `B`, gzip-friendly zeros, compresses to **200–400 KB per adapter from ~4 MB**. Cites FLASC 2024 (Kuo & Raje) + Sparse-BitNet 2026. Already implemented — this is the protocol for operator-side federated fine-tuning in [iz](https://github.com/abgnydn/iz).

## Honest caveats

- **Inference is 0xbitnet, not hand-written.** The [zero-tvm](https://github.com/abgnydn/zero-tvm) 10-shader thesis doesn't apply here — BitNet inference goes through 0xbitnet's ~2 K-line engine, the only practical way to run a ternary 2B-param LLM in a browser today.
- **LoRA is on the LM head only.** Adapting attention / FFN blocks would require per-layer readbacks and a much larger CPU optimizer. Keeping it on the tied-embedding LM head is what makes the 4 MB adapter + CPU-only training budget work.
- **Training step hitches the UI for ~86 ms.** `adam_lora.wgsl` is in place; whether the runtime driver dispatches it or falls back to the CPU Adam path is worth checking in `train-head.ts`.

## Lineage

Forked from [zero-tvm](https://github.com/abgnydn/zero-tvm) (the original 10-shader hand-written Phi-3-mini browser stack). The `zero-tvm-upstream` git remote tracks the upstream; rebase from there to pick up Phi-3 changes.

## Related

- [zero-tvm](https://github.com/abgnydn/zero-tvm) — original Phi-3 inference engine (this fork's parent)
- [fusedx](https://github.com/abgnydn/fusedx) — vision-side substrate (shader-gen + train-engine + gradient-free ES)
- [iz](https://github.com/abgnydn/iz) — downstream consumer (per-facility `.flora` adapters for emissions verification)
- [0xbitnet](https://github.com/0xbitnet/0xbitnet) — the BitNet inference engine this builds on (one 6-line patch)

## License

MIT
