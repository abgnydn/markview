<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/hero-dark.svg">
  <img alt="Neuropulse — real-time 1:1 visualization of a full-scale LLM forward pass" src="public/hero-light.svg" width="100%">
</picture>

<br>
<br>

### The first accurate real-time visualization of a full-scale LLM forward pass.

3.8 billion parameters. Your GPU. Your browser. Every tensor rendered 1:1.<br>
No server. No API key. No fakery.

<br>

[![License: MIT](https://img.shields.io/badge/license-MIT-1f2328?style=flat-square)](LICENSE)
[![Model: Phi-3-mini](https://img.shields.io/badge/model-Phi--3--mini-1f2328?style=flat-square)](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct)
[![Runtime: WebGPU](https://img.shields.io/badge/runtime-WebGPU-1f2328?style=flat-square)](https://www.w3.org/TR/webgpu/)
[![Validated: HF reference](https://img.shields.io/badge/validated-HF%20reference-1f2328?style=flat-square)](#validation)
[![GitHub stars](https://img.shields.io/github/stars/abgnydn/neuropulse?style=flat-square&color=1f2328)](https://github.com/abgnydn/neuropulse/stargazers)

<br>

[**Launch Demo**](https://neuropulse.live/app/) &nbsp;·&nbsp; [**Read the Essay**](https://neuropulse.live/) &nbsp;·&nbsp; [**Methods**](METHODS.md) &nbsp;·&nbsp; [**Predictions**](PREDICTIONS.md) &nbsp;·&nbsp; [**Standards**](RESEARCH_STANDARDS.md)

<br>

</div>

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/stats-dark.svg">
  <img alt="3.8B parameters · 11 WGSL kernels · 22 GPU buffers · 292 dispatches per token · 32 transformer layers · 0 frameworks in inference" src="public/stats-light.svg" width="100%">
</picture>

</div>

<br>

> [!NOTE]
> **Strict 1:1.** Every pixel on screen is a function of a real GPU tensor. The brightness of each point **is** the activation value. The lines between attention heads **are** the real attention weights. The token probabilities rolling across the screen **are** the actual logits from the final layer.

<br>

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/preview-dark.svg">
  <img alt="Neuropulse running in the browser — residual stream cluster, attention rays, side panels for ablation and per-head attention, logit lens, and prompt input" src="public/preview-light.svg" width="100%">
</picture>

<sub>A stylized snapshot of the live in-browser visualizer. Open <a href="https://neuropulse.live/app/">neuropulse.live/app/</a> to drive your own.</sub>

</div>

<br>

## The problem

Every "AI visualization" you've seen online is **decoration**.

Animated dots pulsing to a fake rhythm. Particle systems that aren't connected to anything real. A beautiful metaphor with no model behind the curtain. You walk away thinking you saw how an LLM works. You didn't — you saw how a designer *imagines* it works.

Neuropulse is the opposite. Type a prompt. Watch 3.8 billion parameters process it. Nothing is interpolated. Nothing is smoothed. Nothing is made up.

<br>

## How it compares

Two separate worlds existed — visualization tools that run toy models, and inference engines with zero internal visibility. Nothing connected them.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/comparison-dark.svg">
  <img alt="Comparison grid: Brendan Bycroft's LLM Viz, Transformer Explainer, BertViz, WebLLM, and Neuropulse across six dimensions — real model, scale, browser, 3D, live tensors, validated" src="public/comparison-light.svg" width="100%">
</picture>

</div>

<details>
<summary><sub>Same data as a plain-text table</sub></summary>

| | Real model | Scale | Browser | 3D | Live tensors | Validated |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| [Brendan Bycroft's LLM Viz](https://bbycroft.net/llm) | Toy (sorts ABC) | ~1K | Yes | Yes | Yes | No |
| [Transformer Explainer](https://poloclub.github.io/transformer-explainer/) | GPT-2 small | 124M | Yes | No | Partial | No |
| [BertViz](https://github.com/jessevig/bertviz) | HF models | Any | No | No | Attn only | No |
| [WebLLM](https://webllm.mlc.ai/) | Yes | Multi-B | Yes | — | — | — |
| **Neuropulse** | **Phi-3-mini** | **3.8B** | **Yes** | **Yes** | **All** | **HF ref** |

</details>

<br>

## What you're actually watching

The 3D scene is not a metaphor. Each element maps to a named tensor in Phi-3-mini's compute graph.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/scene-dark.svg">
  <img alt="The four elements of the Neuropulse scene: residual stream, attention heads, gated MLP, and token strip" src="public/scene-light.svg" width="100%">
</picture>

</div>

The layout isn't arbitrary. Residual-stream positions come from PCA of the model's own layer-0 `qkv_proj` weight matrix — dimensions that get read into attention together cluster together. The geometry is shaped by the model, not by a designer.

<br>

## Architecture

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/architecture-dark.svg">
  <img alt="Neuropulse architecture: prompt → tokenizer → embedding → 32× transformer block → LM head → sampler → token (auto-regressive loop), with a parallel render path reading activations from the same GPU buffers" src="public/architecture-light.svg" width="100%">
</picture>

</div>

Inference and visualization share the same GPU buffers. The renderer doesn't recompute anything — it reads the values the model already produced.

<br>

## Anatomy

Thirty-two transformer layers. The residual stream flows top-to-bottom; each row below is one named tensor in Phi-3-mini's compute graph.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/layers-dark.svg">
  <img alt="Anatomy poster: 32 transformer layers visualized as horizontal activation strips, with checkpoint annotations on the right side at the layers where HuggingFace parity is validated" src="public/layers-light.svg" width="100%">
</picture>

</div>

The nine annotated rows are the parity checkpoints — `VALIDATE_LAYERS = {0, 4, 8, 12, 16, 20, 24, 28, 31}` in `src/engine/inference.ts`. Each checkpoint compares the live 3,072-dim residual against a pinned HuggingFace fp16 dump.

<br>

## Validation

"Strict 1:1" is a strong claim, so it has to be falsifiable. Neuropulse ships with a built-in test suite that diffs the WebGPU forward pass against a reference HuggingFace fp16 Phi-3-mini.

> [!TIP]
> Click the wrench icon in the demo. The numbers from **your** GPU print to **your** browser console in under a minute. No setup, no install — your machine is the test rig.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/validation-dark.svg">
  <img alt="Validation suite — 6 tests against a HuggingFace fp16 reference, each with its bound and observed value" src="public/validation-light.svg" width="100%">
</picture>

</div>

Expected result: tiny deltas at hidden-state level (int4 quantization cost, not implementation drift) and identical top-1 tokens vs the fp16 reference. That last bit is the bar that matters.

A second layer of validation runs in CI: `npm run verify` cross-checks documented claims (layer count, kernel count, dispatch counts, keyboard shortcuts) against the actual source. If the README drifts from the code, the build fails.

<br>

## The stack

Four pieces. No frameworks in the inference path. No dependency soup.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/stack-dark.svg">
  <img alt="The stack — four quadrants: Inference (WebGPU · 11 WGSL kernels · 22 GPU buffers · 292 dispatches/token · q4f16_1), Rendering (Three.js · strict 1:1 · PCA layout · audio · soft Gaussian sprites · dockable panels), Weights (Phi-3-mini · MLC · Cache API + OPFS · streaming load · instant reload), UI (vanilla TypeScript · zero frameworks · Vite · ~3,400 LOC · CI-verified)" src="public/stack-light.svg" width="100%">
</picture>

</div>

<br>

### The 11 WGSL kernels

Every kernel has a job, an accumulator precision, and a declared error budget. They all run on the GPU you already own.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/kernels-dark.svg">
  <img alt="Kernel rack — the 11 WGSL compute shaders with their role, accumulator precision, max relative error, dispatches per token, and resident bytes" src="public/kernels-light.svg" width="100%">
</picture>

</div>

Numbers track [`METHODS.md`](METHODS.md) — the precision matrix and tolerances are the contract this project keeps.

<br>

## Inside the demo

Once the weights load, the demo is more than a single 3D view. Ten draggable panels, five view modes (one at a time), four overlays that stack on top of any view, and a keymap covering the whole interaction surface.

### Ten panels — every one a live tensor

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/panels-dark.svg">
  <img alt="Panel inventory: Output, Top-K, Confidence, KV Cache, Heatmap (32×32 heads), Residual Norm, Layer Δ, Residual Strip, Attn L31, Logit Lens — each card has a stylized glyph, name, one-line role, and an italic description of what tensor it surfaces" src="public/panels-light.svg" width="100%">
</picture>

</div>

Every panel is screen-anchored, draggable, dockable as an orb in the bottom rail, and persists its position to `localStorage`. Press <kbd>P</kbd> or <kbd>Tab</kbd> to hide them all; <kbd>O</kbd> to collapse them into orbs.

<br>

### Controls and modes

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/controls-dark.svg">
  <img alt="Controls and modes — left column lists the five view modes (Journey, Scene, Attention, Logit Lens, Cinematic) and the four overlays (Ablation, Butterfly, Kid, Soft) with bindings and descriptions; right column is the keymap grouped into Camera, Journey, Panels, and System" src="public/controls-light.svg" width="100%">
</picture>

</div>

**Ablation** is the empirical-lab gate: zero out attention, FFN, or RoPE and watch the output collapse — proof that the circuit you turned off was actually doing something.

**Butterfly** is a transgenerational context-compaction demo. The built-in run walks a 5-message debugging transcript through `N_GENERATIONS = 3` "metamorphoses". Each generation:

1. A **tagger** call asks Phi-3 to label every message `keep / summarize / melt` with a 4–7-word reason.
2. A **chrysalis** call rebuilds the tagged transcript into a single coherent context at `TARGET_TOKENS = 400`.
3. Four hardcoded **noise messages** are injected for the next round.

After three metamorphoses, the same **needle question** (planted root-cause fact in message 4) is asked against two arms at the same token budget: (a) the butterfly's final rebuild, and (b) a recency-truncated `lastN` baseline. A separate **LLM-as-judge** Phi-3 call grades each answer **hit / partial / miss** against the expected fact.

Meanwhile the residual-stream slabs in the 3D scene get modulated by tag importance — `keep = 1.0`, `summarize = 0.55`, `melt = 0.12` brightness, with 30% intra-generation decay and 60% inter-generation decay — so you literally watch keep-tagged content stay bright across metamorphoses while melted content fades.

The transcript, question, and expected fact are all **editable** (the built-in JWT off-by-one story is just the default). Step-mode pauses between generations for inspection. If the ablation panel is active, the snapshot is **frozen at run-start** and passed to every tagger / chrysalis / answer call — the judge stays unablated so the rubric meter is stable across conditions.

**Kid mode** turns the model into its own narrator. All three are toggles, not separate tabs — switch on the fly during a single forward pass.

<br>

<details>
<summary><strong>Source tree</strong></summary>

```
src/
├── engine/
│   ├── shaders/               # WGSL compute kernels
│   │   ├── attention.wgsl         # multi-head attention
│   │   ├── attention_scores.wgsl  # QK^T / sqrt(d)
│   │   ├── rope.wgsl              # rotary position embeddings
│   │   ├── int4_matmul.wgsl       # quantized matrix multiply (f16 accum)
│   │   ├── int4_matmul_f32.wgsl   # quantized matrix multiply (f32 accum)
│   │   ├── fused_ffn.wgsl         # gated MLP (SiLU + gate + down)
│   │   ├── rms_norm.wgsl          # RMS layer normalization
│   │   ├── embedding.wgsl         # token embedding lookup
│   │   ├── kv_append.wgsl         # KV cache append
│   │   ├── add_norm.wgsl          # residual add + norm
│   │   └── argmax.wgsl            # greedy token selection
│   ├── compiler.ts            # pipeline compilation + buffer mgmt
│   ├── inference.ts           # forward pass orchestration
│   ├── tokenizer.ts           # BPE tokenizer (zero deps)
│   ├── weight-loader.ts       # Cache API streaming + progress
│   └── activation-reducer.ts  # tensor readback for visualization
├── visualizer.ts              # Three.js — strict 1:1 tensor rendering
├── audio.ts                   # sonification of live tensor data
└── main.ts                    # app shell + UI + interaction
```

</details>

<br>

## The Butterfly experiment

Butterfly is more than one of the four overlays — it's a real, **pre-registered** test of a context-compaction mechanism. We filed it wrong the first time, refuted our own claim, then re-filed against a harder regime and confirmed it. Both pre-registrations and outcomes live in [`PREDICTIONS.md`](PREDICTIONS.md).

The question: at a fixed token budget, does **tag-and-rebuild** preserve load-bearing information better than naive `lastN` truncation?

### Two regimes, two outcomes

| pre-registration | regime | result |
|---|---|---|
| [P-20260512-05](PREDICTIONS.md#p-20260512-05--butterfly-compaction-beats-lastn-at-the-same-token-budget) | 1 generation · 400-token budget · ~12-message transcripts | **REFUTED.** LastN tied on 2 of 4 transcripts, beat butterfly on the other 2. At a generous budget on short transcripts, lastN already preserves the needle — butterfly has nothing to do. |
| [P-20260515-06](PREDICTIONS.md#p-20260515-06--butterfly-beats-lastn-under-multi-gen-noise-pressure-pure-code-variant--confirmed) | **3 generations · 100-token budget · ~38-message transcripts** with fresh noise injected each round | **CONFIRMED.** All 4 transcripts: butterfly preserves 100% of needle keywords, lastN preserves 0%. Mean delta = 100 percentage points. |

The transgenerational survival claim — keep-tagged content carries through each cocoon while noise pushes the original out of lastN's window — is observable end-to-end in the per-generation trace.

### Where the mechanism actually matters — phase diagram

Two binary outcomes don't tell you *where* butterfly stops mattering. So we swept the cube: 8 budgets × 6 transcript lengths × 5 generation counts × 4 transcripts = 960 configurations. Total runtime: 82 ms. The mean delta (butterfly_frac − lastn_frac) across the 4 transcripts, per `(length × budget)` cell, at three generation depths:

```
─── gens = 1 ─────────────────────────────────────────────────
len ↓ \ budget →   50   75  100  150  200  300  400  600
  12               ██   ██   ▸▸    ·    ·    ·    ·    ·
  20               ██   ██   ██    ·    ·    ·    ·    ·
  30               ██   ██   ██   ▸▸    ·    ·    ·    ·
  50               ██   ██   ██   ██   ██    ·    ·    ·
  80               ██   ██   ██   ██   ██   ██   ▸▸    ·
 120               ▸▸   ██   ██   ██   ██   ██   ██   ██

─── gens = 3 ─────────────────────────────────────────────────
  12               ▸▸   ██   ██   ██   ▸▸    ·    ·    ·
  20               ▸▸   ██   ██   ██   ██    ·    ·    ·
  30               ▸▸   ██   ██   ██   ██    ·    ·    ·
  50               ▸▸   ██   ██   ██   ██   ██    ·    ·
  80               ▸▸   ██   ██   ██   ██   ██   ██    ·
 120               ▸▸   ██   ██   ██   ██   ██   ██   ██

─── gens = 5 ─────────────────────────────────────────────────
  12               ▸▸   ██   ██   ██   ██   ▸▸    ·    ·
  20               ▸▸   ██   ██   ██   ██   ██    ·    ·
  30               ▸▸   ██   ██   ██   ██   ██    ·    ·
  50               ▸▸   ██   ██   ██   ██   ██   ██    ·
  80                ▸   ██   ██   ██   ██   ██   ██   ▸▸
 120                ·   ▸▸   ██   ██   ██   ██   ██   ██

  ██ Δ≥0.60   ▸▸ 0.30..0.60   ▸ 0.10..0.30   · -0.10..0.10   ◀ -0.30..-0.10   ◀◀ ≤-0.30
```

Three observations:

1. **The boundary is roughly diagonal.** Butterfly stops mattering once budget grows past ~30-40% of the original transcript size — `lastN` already captures the needle.
2. **More generations expand the win region.** Each metamorphosis pushes more original content out of `lastN`'s window via noise injection. By gens=5 even a 12-message transcript wins at budget=300.
3. **The two pre-registered points land where the heatmap says they should.** P-20260512-05 (len=12, budget=400, gens=1) sits in the `·` tie zone — REFUTED. P-20260515-06 (len≈30, budget=100, gens=3) sits deep in the `██` zone — CONFIRMED.

Reproduce: `node tools/butterfly-sweep-phasediagram.mjs`. Custom grid: `GENS=3 BUDGETS=50,100,200,400 LENGTHS=20,50,100 node tools/...`.

### Replication with a learned tagger — partial refutation, hardened

The natural objection to the regex tagger: *"butterfly only wins because the regex happens to fit your 4 transcripts' shapes."* To check, we swapped the regex for an LLM tagger and re-ran the two pre-registered points across multiple models and prompt strategies.

```
tagger configuration                                regime      result
─────────────────────────────────────────────────────────────────────────────
regex (rule-based, ~8% keep rate)                   hard        100% / 0%  Δ=100pp  ✓
qwen3-14b-mlx · JSON batch, no cap                  hard          0% / 0%  Δ=0pp
gemma-4-e4b · one-char output, cap=5                hard         25pp avg (1/4 win via regex fallback)
qwen3-14b-mlx · one-char output, cap=5              hard          0% / 0%  Δ=0pp
qwen3-14b-mlx · one-char output, cap=3 (strictest)  hard          0% / 0%  Δ=0pp
(any tagger)                                        easy        100% / 100%  Δ=0pp  (regime doesn't differentiate)
```

**Three LLM configurations all fail to replicate the regex win at the hard regime.**

What we tried in the one-char strategy:
- One character per message (`k` / `s` / `m`) — no JSON, no parse failures
- Hard cap on `keep` count enforced in code (excess keeps get demoted to summarize, dropping later-position keeps first)
- Identifier-first prompt — "only `keep` if the message contains a unique identifier an engineer must act on: file path, line range, ticket ID, code call, decision marker, named owner + channel"

The cap is respected in the trace (gen 1: 26 melt / 9 summarize / 3 keep when `MAX_KEEPS=3`), but the 3 keeps the LLM picks are **not the needle-carrying messages**. Qwen3 prioritizes decision-language and emphatic statements ("Decision:", "Confirmed:", "Let's do X") — but the regex prioritizes literal shapes (`lib/jwt.ts`, `#auth-platform`, `Date.now()`). On our 4 transcripts the needle keywords ARE literal shapes, not just emphatic decisions. The LLM's prior misses by a different axis than its selectivity.

**The hardened finding.** Tag-and-rebuild beats `lastN` *only when the tagger's prior matches the needle's shape distribution.* This is a stronger claim than "selectivity matters" — selectivity alone wasn't enough (we tested it). The tagger has to be biased toward the *specific kind* of content the needle takes (literal identifiers vs decision language vs entity mentions). The regex's bias is hard-coded to match `file:line` / `#channel` / `Decision:` / `@org/pkg` shapes, which happen to be exactly what our 4 transcripts plant as needles. A frontier-instruction-tuned model with generic "find what's important" semantics misses the needle even with a strict selectivity cap.

What this means in practice: butterfly's mechanism is **domain-dependent**. The "right tagger" for software-engineering chat transcripts is one that fires on identifier-shaped content. The "right tagger" for legal/medical/financial transcripts would be different. **There is no universal butterfly.** Building a working butterfly for a domain means designing or training a domain-specific tagger first.

Reproduce: `MODEL=qwen3-14b-mlx STRATEGY=onechar MAX_KEEPS=3 CONFIGS=len38-bud100-gens3 node tools/butterfly-llm-tagger.mjs`. Results in `test-results/butterfly-sweep/butterfly-llmtagger-*.json`.

### Train a tagger from scratch — can a tiny learned classifier replicate regex?

Two more taggers, both trained on the regex's own labels:

| tagger | params | size | needle preservation @ hard regime |
|---|---|---|---|
| Regex (hand-tuned thresholds) | ~14 hard rules | source code | **100% / 0%  Δ=100pp** |
| **14-feature softmax** (gradient descent on regex labels) | 45 | 1.2 KB | **100% / 0%  Δ=100pp** |
| **768-dim embed + linear head** (nomic-embed-text + softmax) | 2,307 | 45 KB | **100% / 0%  Δ=100pp** |
| qwen3-14b-mlx · onechar prompt · cap=3 | (frontier) | — | 0% / 0%  Δ=0pp |

Both learned classifiers reach 100% training accuracy in seconds and reproduce the regex's mechanism win exactly. This is partly tautological (training labels come from the regex) but it confirms: **gradient descent over either hand features OR raw text embeddings recovers the same boundary the hand-tuned thresholds picked**. The mechanism isn't hiding in some pathological piece of regex code — it's in the *shape distribution of the features the regex weighs*.

Reproduce: `node tools/butterfly-train-classifier.mjs && STRATEGY=trained node tools/butterfly-llm-tagger.mjs` for the 1.2 KB version. Or `tools/butterfly-train-embed.mjs && STRATEGY=embed node tools/butterfly-llm-tagger.mjs` for the embedding version.

### Adversarial transcripts — testing the shape claim directly

Four new transcripts where the needle is real, load-bearing content but does **NOT** take any of the shapes the regex catches:

| transcript | needle (load-bearing fact) | needle shape |
|---|---|---|
| `numeric-threshold` | "we agreed on a hard cap of **47 concurrent connections per pod**" | a number in prose, no `req/min` suffix |
| `implicit-deadline` | "**cooper said end of next week, friday the 24th**" | lowercase name + relative date phrasing |
| `preference-statement` | "i **don't want to go with postgres** for this — too heavy for our write pattern" | stated preference, no `Decision:` marker |
| `buried-causation` | "the **rollback brought back the version-pinned dependencies that were the actual blocker**" | causation in prose, no `Root cause:` marker |

Results on these 4, same hard regime (38 msgs, 100 tok, 3 gens), 4 taggers:

```
tagger              mean Δ across 4 adversarial transcripts
─────────────────────────────────────────────────────────
regex                0pp   (all messages → melt, including the needles)
trained (14-feat)    0pp   (inherits regex's blind spots)
embed (768-dim)      0pp   (trained on regex labels — same blind spots)
qwen3-14b · onechar  0pp   (picks 5 messages with cap, but
                            still 0% on the needle keywords)
```

**Every tagger we tested fails on adversarial.** The regex and its learned descendants tag everything as `melt` (no signal fires). Qwen3 picks 5 messages it considers important, but they're not the needle-carrying ones — *and* the chrysalis bloats with the 5 keeps + 13-19 summarizes, blowing the 100-token budget so even useful content gets truncated.

There's a worse twist: across all 4 adversarial transcripts, the qwen3 tagger's gen-3 chrysalis output is **identical** — just a noise message from gen 2 injection (`"did anyone actually try the new prod metrics dashboard?"`). The original conversation is gone entirely by gen 3.

**That's a new finding the original confirmation didn't show:** the multi-generation noise injection acts as a feedback loop that amplifies any tagger's gen-1 weakness. Once the needle gets dropped in the first cocoon, no later generation can recover it — the only thing surviving across generations is whatever the tagger consistently labels as keep, and if that's noise, the protocol locks in on noise.

Reproduce: `node tools/butterfly-adversarial.mjs`.

### External benchmark — LongMemEval oracle (500 real conversations)

The natural next test: does the regex-tagger win replicate on an independent dataset? [LongMemEval](https://github.com/xiaowu0162/LongMemEval) (ICLR 2025) is the canonical long-term-conversational-memory benchmark, cited by MemoryAgentBench (ICLR 2026). Each example is a list of `{role, content, has_answer: bool}` sessions; ground truth is the set of evidence turns flagged `has_answer: true`.

Direct score: "what fraction of evidence turns survive in the compacted memory" — no LLM judge needed.

```
tagger         params   in-domain  ──── LongMemEval (500 examples) ────
                                   bud=256   bud=512   bud=1024  bud=2048
─────────────────────────────────────────────────────────────────────────
Regex            ~14      100/0    21.4%     22.6%     26.3%     29.0%
Trained 14-feat   45      100/0     4.6%      4.6%      4.7%      4.7%
Embed 768-d    2,307      100/0     0.0%      0.0%      0.0%      0.0%
LastN baseline      -       —       3.3%      5.2%     12.3%     23.4%
```

Three real findings:

1. **The regex tagger wins on independent data**, by +5 to +18pp across all tested budgets. Not just our 4 hand-written transcripts — the win replicates on 500 real conversations from a peer-reviewed benchmark.
2. **More parameters → worse generalization** when training data is small. The 14-feature classifier (45 params) flat at 4.7% on LongMemEval despite hitting 100% on the in-domain set. The 768-dim embedding classifier (2,307 params) is *worse still* — 0% turn rate at every budget. Both overfit to the 100-message in-domain training set.
3. **Different metrics, different winners — and a hybrid that wins both.** Regex wins evidence-turn preservation. LastN wins *answer-string-in-memory* at high budgets (116/479 vs 63/479 at bud=2048) — because LongMemEval answers often appear in recent context, where lastN keeps everything. We tested a hybrid that splits the budget 60/40 between butterfly chrysalis (selectivity) and a lastN window (recency); it matches or beats regex on turn-rate at all budgets ≥ 512 AND boosts answer-recall from 63/479 to 99/479 at bud=2048, closing most of the gap to lastN. Best-of-both-worlds.

### Even harder regime — LongMemEval s (~121K tokens, 550 turns, only 2 evidence turns per example)

The `longmemeval_s` split adds ~38 filler sessions between evidence sessions per example. 500 examples × ~121K tokens avg = an honestly adversarial benchmark. Even at budget=4096 (≈3.4% of original) the absolute numbers are low — only 7% of evidence turns survive — but the directional finding stays:

```
budget    regex turn  hybrid turn  lastN turn   regex ans  hybrid ans  lastN ans
─────────────────────────────────────────────────────────────────────────────────
 512        1.1%        0.8%         0.0%          16          25          14
1024        1.8%        1.1%         0.2%          26          29          20
2048        3.4%        2.6%         0.7%          38          36          29
4096        7.0%        4.6%         3.5%          60          52          45
```

Butterfly's regex tagger beats lastN at every budget on both metrics. Margins are smaller than on oracle because the needle-to-haystack ratio (2 in 550) is much worse — but the direction is consistent across two independent peer-reviewed datasets. The mechanism is real on diverse external data, not just our 4 hand-written transcripts.

### Train the classifier on the right distribution — it triples the regex baseline

The natural objection: our trained classifier failed on LongMemEval because we trained it on 100 messages from 4 unrelated hand-written transcripts. Train it on LongMemEval's *own* labeled data and see if it generalizes.

Each turn in `longmemeval_oracle` has a `has_answer: true/false` flag — direct supervision. 500 examples × ~22 turns = ~11K labeled training examples. We trained a 14-parameter binary softmax classifier (same features) on the oracle's has_answer labels, then evaluated on `longmemeval_s` (different examples, never seen during training, much more filler).

```
longmemeval_s, 500 held-out examples, turn-rate evidence preservation:

budget    regex      longmem-trained   hybrid    lastN
                                                  
 512       1.1%         2.5%    +1.4pp   0.8%     0.0%
1024       1.8%         4.4%    +2.6pp   1.1%     0.2%
2048       3.4%         9.2%    +5.8pp   2.6%     0.7%
4096       7.0%        20.6%   +13.6pp   4.6%     3.5%      ← 3× regex baseline
```

A 14-parameter classifier trained on LongMemEval's own labels **nearly triples** the regex baseline at the most useful budget and **6× the lastN baseline**. The "trained classifiers don't generalize" finding from earlier reverses — they generalize fine *if you train them on a representative distribution*. The previous trained classifier failed because the training set was 100 messages from 4 unrelated transcripts.

And on the *easier* oracle benchmark — same trained classifier, no retraining — the win is dramatic:

```
longmemeval_oracle, 500 examples, turn-rate evidence preservation:

budget    regex      longmem-trained   longmem-hybrid   lastN
                                                         
 512      22.6%        69.7%   ↑↑↑      54.1%           5.2%
1024      26.3%        83.7%   ↑↑↑      77.6%          12.3%
2048      29.0%        86.1%   ↑↑↑      87.2%          23.4%   ← +63.8pp vs lastN
```

**86% of evidence turns preserved at a 2K-token budget** on ~6.6K-token contexts (3× compression). The longmem-trained classifier alone hits 86.1%. Adding the lastN window (longmem-hybrid) pushes to 87.2% AND boosts answer-in-memory from 125/479 → 145/479 — also beating lastN's previously-dominant 116/479 on that metric.

What works where:

| dataset | best tagger | best budget result | vs lastN |
|---|---|---|---|
| oracle (~6.6K tok) | longmem-hybrid | 87% turn-rate @ 2K | +64pp |
| longmemeval_s (~121K tok) | longmem-trained | 20% turn-rate @ 4K | +17pp |

On short/medium contexts, the lastN window in the hybrid adds value because answers tend to live in recent turns. On 121K-token contexts, the last-N window is mostly filler — the trained classifier alone wins.

### Per-question-type — where the classifier wins and where it doesn't

The 86% headline aggregates across six LongMemEval question types. Broken out (oracle, budget=2048, longmem-trained classifier):

```
question_type                  n    bfly%   lastN%   Δ
─────────────────────────────────────────────────────────
single-session-preference     30    100%      7%   +93pp
multi-session                125     91%      8%   +83pp
knowledge-update              72     90%     11%   +79pp
temporal-reasoning           132     83%     11%   +72pp
single-session-user           64     92%     39%   +53pp
single-session-assistant      56     64%     93%   -29pp   ← LASTN WINS
```

The classifier wins 5/6 question types by 50-93pp — and *loses* on `single-session-assistant` by 29pp. The reason is in the learned weights: `log_length: -3.25` heavily down-weights long messages. On most question types the evidence is short user statements, where this prior is correct. But on `single-session-assistant` the evidence is in long assistant responses — exactly what the classifier learned to ignore.

Production implication: **question-type routing or a richer feature set is needed** to handle every case. The 1.2 KB classifier alone won't get you there; a hybrid (route some types to lastN, others to the classifier) gets you 100% coverage with the right router.

### Cross-domain test — does the trained classifier work outside its training distribution?

The longmem-trained classifier crushes LongMemEval at 87% turn-rate. But its learned weights are negative on identifier features (`file_path`, `decision_kw`, `proper_name`) — exactly opposite of what the regex tagger needed to win on our engineering chat transcripts. So: does it still work on engineering chat?

Tested on the original 4 engineering transcripts at the hard regime (38 msgs, 100-token budget, 3 gens):

```
transcript                regex    in-domain trained    longmem-trained
jwt-clock-race            100%        100%                 0%
auth-owner-pto            100%        100%                 0%
rate-limit-decision       100%        100%                 0%
cache-race-fileline       100%        100%                20%
```

**The classifier is domain-locked.** It works at 87% on LongMemEval and at ~5% on engineering chat. Same architecture, same 14 features — but training on personal conversation data makes it predict "shorter = evidence," which is exactly wrong for engineering chat where evidence is "long assistant messages with file paths."

So production butterfly is **one classifier per deployment domain**. Not "train one universal compaction tagger." Either:
- Multiple classifiers, each trained on its own domain's labeled data, and a domain-router on top, OR
- A richer multi-domain training set that covers all your deployment surfaces.

Either way, the engineering cost is in collecting labeled examples from the actual domain you'll deploy in. The classifier itself is cheap (45 parameters, training in seconds).

### Stress test — longmemeval_m (1.25M tokens, 5,057 turns per example)

The largest LongMemEval split. Each example has 501 sessions, 5,057 turns, ~1.25M tokens of context — and **only 1 evidence turn**. A 1:5,057 needle. We ran the full 500-example sweep at budgets from 4K to 32K tokens (the 32K budget represents ~2.5% of original, a 39× compression):

```
longmemeval_m, 500 examples, ~1.25M tokens, 5057 turns per example:

budget    regex   longmem-trained   longmem-hybrid   lastN
 4096      0.5%      1.8%             1.1%            0.1%
 8192      0.9%      5.1%             2.9%            0.7%
16384      2.6%      9.8%             6.6%            1.2%
32768      5.5%     18.8%            12.5%            2.8%   ← 7× lastN, 3.4× regex
```

At budget=32K (2.5% of original context size), the trained classifier preserves **19% of evidence turns** — finding 1 needle in 5,057 turns at 7× lastN's rate. The direction is consistent with the smaller splits: longmem-trained > longmem-hybrid > regex > lastN at every budget.

**The pattern holds across three orders of magnitude of context size:**

| split | avg context | longmem-trained @ best budget | vs lastN |
|---|---|---|---|
| oracle | 6.6K tokens | 86.1% @ 2K (3× compression) | +63pp |
| s | 121K tokens | 20.6% @ 4K (30× compression) | +17pp |
| m | 1.25M tokens | 18.8% @ 32K (39× compression) | +16pp |

Same 1.2 KB classifier file, three benchmarks, consistent direction. The mechanism scales.

The learned weights look completely different from the in-domain version:

```
                    in-domain trained    longmem trained
file_path           +2.98 (keep)         -0.04   (flipped)
decision_kw         +2.41 (keep)         -0.52   (flipped!)
proper_name         +1.34 (keep)         -0.43   (flipped!)
log_length          +0.21                -3.25   (DOMINANT: shorter = evidence)
bias                -1.74                +3.13   (default keep, modulated by length)
```

The model learned that on LongMemEval, **evidence is short user statements** ("I graduated with Business Administration"), not long assistant explanations. Identifier features are *anti-correlated* with evidence here because they appear in the long assistant responses that AREN'T evidence. Reversed prior, reversed weights. The 14-feature template was rich enough to encode either prior.

**The full story:** the mechanism is real, the tagger does the work, and a tiny domain-trained classifier substantially outperforms hand-coded rules — provided you train it on data representative of where you'll deploy it. The engineering recipe is "label a few hundred examples from your target, train a 14-parameter classifier, ship a 1.2 KB model." Not "build a smart LLM tagger." Not "tune a hand-coded regex forever."

### The fully hardened claim

Putting all the rounds together:

> A 14-parameter softmax classifier trained on ~11K has_answer-labeled turns from LongMemEval **preserves 87% of evidence turns at a 2K-token budget on the oracle benchmark** (3× context compression), vs lastN's 23% and a hand-coded regex's 29%. On the harder *longmemeval_s* held-out split (121K-token contexts, 550 turns per example), the same classifier triples the regex baseline. Training on the wrong distribution underperforms hand rules; training on the right distribution outperforms by ~60 percentage points. Generic "find what's important" prompts on frontier LLMs don't replicate the mechanism either.
>
> **The engineering work is the tagger and its training distribution.** Ship a 1.2 KB classifier, not an LLM agent loop.

### Reproduce in 4 ms

The harder-regime experiment runs in **pure code, no LLM, no GPU**:

```bash
node tools/butterfly-purecode-hard.mjs           # all 4 transcripts
DEBUG=1 node tools/butterfly-purecode-hard.mjs   # full per-generation trace
TRANSCRIPTS=jwt-clock-race node tools/butterfly-purecode-hard.mjs
```

Output is deterministic. Same input → same answer. The regex tagger is rule-based (file paths, ticket IDs, Slack channels, package mentions, line ranges, decision markers → keep; bare acks + short tangents → melt). The chrysalis is mechanical concatenation truncated to budget. The scoring is keyword-coverage against the load-bearing identifiers in each transcript's expected fact.

### What this proves — and what it doesn't

This isolates the **compaction mechanism** from every confounding question: is the tagger smart enough, can the rebuilder compress, will the judge be consistent, does the model finish in time. We answer one question, cleanly:

> *At sufficient compression pressure with noise compounding, tag-and-rebuild preserves load-bearing content where naive truncation does not.*

What this does **not** claim:

- **Not a tagger-agnostic claim.** As the LLM-tagger replication above shows, the regex tagger's bias toward needle-shaped patterns is load-bearing. A learned tagger with a different prior (Qwen3-14B in our test) does not replicate the win. The mechanism is real but it inherits whatever the tagger prioritizes.
- **Not a generalization across transcripts.** Four transcripts written by one person. This is a mechanism-existence proof on a small, internally consistent set — not a benchmark.
- **Not a substitute for `/compact`.** Frontier-model summarization is cheaper and better when you have access to a frontier model. The "butterfly + small local model" lane is for the local-first niche.

The full methodology — pre-registered thresholds, threats to validity, the original failure mode, the scope-shift to pure code — is in [`PREDICTIONS.md`](PREDICTIONS.md). The implementation is [`tools/butterfly-purecode-hard.mjs`](tools/butterfly-purecode-hard.mjs) — ~340 lines, no dependencies.

<br>

## Run locally

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/runlocal-dark.svg">
  <img alt="Run locally — terminal mockup with the four install commands on the left, requirements table and a first-visit timeline (clone → install → dev ready → 1.94 GB weight download → 11-kernel compile → first token) on the right" src="public/runlocal-light.svg" width="100%">
</picture>

</div>

```bash
git clone https://github.com/abgnydn/neuropulse.git
cd neuropulse
npm install
npm run dev
```

Open **http://localhost:5173/app/** in Chrome, Edge, or Safari Technology Preview. First visit downloads ~2 GB into the browser cache; every visit after that is instant.

> [!IMPORTANT]
> WebGPU is required. Firefox does not ship WebGPU on stable yet; use Chrome, Edge, or Safari Technology Preview.

<br>

## Acknowledgments

- **[Microsoft Phi-3-mini](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct)** — the model under the glass.
- **[MLC](https://mlc.ai/)** — q4f16_1 weight format and the WebGPU inference patterns this project builds on.
- **[Three.js](https://threejs.org/)** — the renderer.
- **[Brendan Bycroft's LLM Viz](https://bbycroft.net/llm)** — proved a transformer could be *seen*. This project asks: can it be seen at scale?

<br>

## Cite

```bibtex
@software{gunaydin_neuropulse_2026,
  author  = {Günaydın, Ahmet Barış},
  title   = {Neuropulse: Real-Time 1:1 Visualization of a Full-Scale LLM
             Forward Pass in the Browser},
  year    = {2026},
  url     = {https://github.com/abgnydn/neuropulse}
}
```

<br>

## License

[MIT](LICENSE) — do whatever you want, just keep the copyright notice.

<br>

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/monogram-dark.svg">
  <img alt="neuropulse — see what your LLM is doing" src="public/monogram-light.svg" width="100%">
</picture>

<sub>Built by <a href="https://github.com/abgnydn">Ahmet Barış Günaydın</a></sub>

</div>
