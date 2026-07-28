# Changelog

All notable changes to draw.instant are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions track the
v0→v5 milestones in [ROADMAP.md](./ROADMAP.md).

## [Unreleased]

### Added
- Project documentation set: `README.md`, `ARCHITECTURE.md`, `BENCHMARKS.md`,
  `LIMITATIONS.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CITATION.cff`,
  this changelog, and a `CLAUDE.md` project guide.
- `LICENSE` (MIT), `package.json` (`start` / `test` / `scope` scripts),
  `.gitignore`, and a CI workflow running the parser test.
- `ops-test.html` — in-browser runner for the previously-orphaned
  `wgsl-ops-test.js` kernel suite, plus batched-MatMul and negative-base Pow
  cases (27/27 on M2).
- Headless discrete-GPU bench tooling: `bench-headless.mjs` (Deno native
  WebGPU), `bench-colab.ipynb`, `modal_bench.py` — see `BENCH.md`.
- Cloudflare Workers (static assets) deploy: `wrangler.toml`, `.assetsignore`,
  `DEPLOY.md`.

### Changed
- Self-hosted WGSL engine (byte-level ONNX parser + op kernels + graph executor)
  runs the VAE decoder end-to-end; U-Net wiring in progress.

### Fixed
- Fusion probe unbiased: removed a temp `createBindGroup` stack-capture
  diagnostic and hoisted bind-group creation out of the timed loops; the
  fused-vs-naive diff is now measured by readback, not asserted. M2: 0.60 ms
  naive / 0.30 ms fused = 2.0× (was 2.67× under the biased bench).
- Live / loop / camera modes are mutually exclusive; the continuous loop
  carries an epoch token (no zombie double loops); camera errors reuse the stop
  path; a probe failure no longer disables Generate; the shared metrics bar
  relabels itself per mode.
- Model downloads persist via the Cache API (`draw-instant-models`) — HF's
  no-store redirects defeated `force-cache`, so the 1.73 GB U-Net re-downloaded
  on every page load.
- Prompt padding uses id 0 after the first eos (OpenCLIP-H pad token), not
  CLIP-base's 49407.
- `vaeEncode` feeds fp16 (the vae-encoder graph I/O is fp16; the f32 feed
  crashed camera mode); f32→f16 converts NaN to quiet NaN.
- Executor/parser: batched MatMul (rank > 2) computes every batch, sign-aware
  `pow`, packed float fields/attributes decoded from the correct span, dynamic
  dims parse as -1, fail-loud guards replace silent-wrong paths.
- Fused-bench headers and captions match what the kernels do (attention bench
  is 3 → 1 with on-chip softmax; ResNet 9 → 4; cross-attn does full softmax
  over S_kv=77, not streaming flash).

### Removed
- Tracked `unet.onnx → /tmp/...` dangling symlink. The optional local-model path
  is now documented in the README and git-ignored.

## [1.2.0] — fused full transformer block
- Hand-fused WGSL full transformer block (attention + FFN + LayerNorm +
  residuals) at the SD-Turbo mid-block shape — the unit that runs ~16× per U-Net
  forward pass.
- Naive 14 dispatches → fused 9 (flash-attention collapses 3→1, GELU folds into
  the FFN-up epilogue, both residuals fold into producer matmuls).
- Apple M2: 28.6 ms naive / 28.3 ms fused (wash); correctness 8.0e-7 max abs diff.

## [1.1.0] — fused attention block
- Scaled-dot-product attention (Q/K/V given — projections excluded to isolate
  the fusion delta) as a single-dispatch, flash-attention-style kernel:
  per-query-row scores softmaxed in workgroup memory, no global writes for
  intermediates.
- Naive 3 dispatches → fused 1.

## [1.0.0] — fused FFN block
- Hand-fused WGSL FFN block (GELU + residual folded into matmul epilogues) at the
  SD-Turbo mid-block shape.
- Same tiled matmul on both paths — delta is fusion, not kernel quality.
- Apple M2: 66.7 ms naive / 66.1 ms fused (wash); 0 max abs diff. Ships the
  benchmark harness.

## [0.3.0] — first real model component
- CLIP text encoder (`Xenova/clip-vit-base-patch16`) on WebGPU fp16 via
  Transformers.js: ~64 MB, IndexedDB-cached, 77 tokens → embedding in ~60–90 ms
  on Apple M2. Proves the model-download + inference-session path end-to-end.

## [0.2.0] — ORT Web + WebGPU EP
- ONNX Runtime Web 1.20.1 loaded from CDN on boot; WebGPU execution provider
  verified and surfaced in the preflight.

## [0.1.0] — fusion probe
- On-device elementwise fusion probe (6 dispatches naive vs. 1 fused over 1M
  floats). Honest Apple-Silicon finding: ~1× on unified memory; thesis holds on
  discrete GPUs.

## [0.0.0] — UI scaffold
- `index.html` + `pipeline.js`, editorial aesthetic. WebGPU preflight with
  capability sniff (f16, workgroup storage, vendor). Prompt / steps / seed /
  guidance controls, metric bar, canvas target.
