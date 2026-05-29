# Commits — fused-lora

## 2026-05-29

- `07:28` **docs(README): rewrite as fused-lora — lead with BitNet+LoRA pivot** — +71 −197 — [`cbfa5d3`](https://github.com/abgnydn/fused-lora/commit/cbfa5d35658684ee772ecd4e05a9f52d085de717)

## 2026-05-20

- `16:58` **BitNet b1.58 2B4T phase — ternary matmul, .flora LoRA, browser demo** — +8601 −320 — [`f180275`](https://github.com/abgnydn/fused-lora/commit/f180275bda527a00102a6d2027ebd48a7cfb865e)

## 2026-04-15

- `14:42` **Pivot to BitNet b1.58 2B4T + keystone ternary matmul shaders (PASSED)** — +860 −489 — [`c17a591`](https://github.com/abgnydn/fused-lora/commit/c17a591be6097f3959c1399e6089fdda2381cfef)
- `14:16` **Gemma 3 270M port: plan + config + first shaders** — +489 −0 — [`df63aff`](https://github.com/abgnydn/fused-lora/commit/df63aff307a12d3e33f7fe9f229b84e4a401191e)
- `13:37` **Phase 5a: training recipe presets (Style / Balanced / Memorize)** — +56 −3 — [`16f10ef`](https://github.com/abgnydn/fused-lora/commit/16f10ef011013d02450759202bedeb1ba6b94d9e)
- `13:34` **Phase 4b: live watch feed — see the adapter learn in real time** — +93 −0 — [`f6c473b`](https://github.com/abgnydn/fused-lora/commit/f6c473b139af3a3a27e0d6df1fc05166e459df4d)
- `13:30` **Phase 2.3e + Phase 4: sampler + .flora adapter save/load** — +457 −5 — [`7580b1e`](https://github.com/abgnydn/fused-lora/commit/7580b1e21e42b72b01925ee9bd4e4d778785b246)
- `12:57` **Phase 2.3: MVP LM-head LoRA training loop — WORKS end-to-end** — +734 −8 — [`08353a4`](https://github.com/abgnydn/fused-lora/commit/08353a402967e131cdc6e48a45b559589bdd1f12)
- `08:32` **Phase 2.2b: add_norm_bwd + int4_matmul_bwd_x** — +335 −3 — [`11d02c6`](https://github.com/abgnydn/fused-lora/commit/11d02c6be9042ca295932461260cd0e06dc7fe16)
- `08:23` **Phase 2.2: cross_entropy_bwd + rms_norm_bwd + rope_bwd** — +744 −0 — [`9c23715`](https://github.com/abgnydn/fused-lora/commit/9c23715f4d84ddc1f567d295e6eec6318066f442)
- `08:08` **Phase 2.1: LoRA backward kernels + CPU-reference gradient check** — +668 −0 — [`2d7e046`](https://github.com/abgnydn/fused-lora/commit/2d7e0468abbcbb6911fbceaa40fe6ba36d46df7d)
- `07:57` **Phase 1: LoRA forward wiring + zero-adapter identity test** — +525 −2 — [`820300b`](https://github.com/abgnydn/fused-lora/commit/820300b286ca5db8089aa151e6547750e8a90355)

## 2026-04-11

- `14:48` **Add Vercel Web Analytics script to user-facing pages** — +5 −0 — [`c00e1e1`](https://github.com/abgnydn/fused-lora/commit/c00e1e195db547dfc1a0aec0f9f3e1db2a5ae567)

## 2026-04-10

- `14:09` **Fix mismatched units in landing-page bundle comparison** — +1 −1 — [`24d200a`](https://github.com/abgnydn/fused-lora/commit/24d200ac74a0c5db3c47ae8842fe6395d28d11cd)
- `08:45` **Extract decode engine, add validate page, add e2e tests** — +1536 −432 — [`d5cfe86`](https://github.com/abgnydn/fused-lora/commit/d5cfe86ae4ec9788545644ff128de060ead40c3c)

## 2026-04-08

- `14:40` **Remove placeholder benchmarks section from README** — +2 −7 — [`1aabf4b`](https://github.com/abgnydn/fused-lora/commit/1aabf4bc1e423ef5089ff36f4ccec2003ee28aa7)
- `11:41` **Move input-wrap/input-inner to shared style.css, remove duplicate fro…** — +14 −31 — [`312a77d`](https://github.com/abgnydn/fused-lora/commit/312a77df1762773a261a92869ea1c07f1d090344)
- `11:38` **Fix compiler-chat input alignment: use same input-wrap pattern as zer…** — +25 −28 — [`7a8cf64`](https://github.com/abgnydn/fused-lora/commit/7a8cf64e5135f9b7551dbea7a321f81015ffe541)
- `11:33` **Add zerotvm.com link to README** — +3 −1 — [`10f3a6b`](https://github.com/abgnydn/fused-lora/commit/10f3a6b8ab6088afefea2b24dc8de7f439b8c386)
- `11:29` **Replace image in README.md** — +1 −1 — [`2870fe9`](https://github.com/abgnydn/fused-lora/commit/2870fe9e2d250ea5967180478d7ff6581e1aa4f9)
- `11:29` **Update OG meta tags to use zerotvm.com domain** — +11 −6 — [`6d95de3`](https://github.com/abgnydn/fused-lora/commit/6d95de348d4edb4b3e34fbc948f05628ce980770)
- `11:21` **Fix tokenizer decode: convert SentencePiece hex byte tokens to actual…** — +5 −1 — [`9dc7373`](https://github.com/abgnydn/fused-lora/commit/9dc7373711b39dd6a862bb92eb34b23f6c01d9eb)
- `10:58` **Add helpful error message for WebLLM Cache.add() failures; gitignore …** — +9 −1 — [`f5887b4`](https://github.com/abgnydn/fused-lora/commit/f5887b44d3c4e53cc7a87592ae9ea044104dc712)
- `10:54` **Cache downloaded shards to Cache API for download resumption** — +11 −2 — [`854080f`](https://github.com/abgnydn/fused-lora/commit/854080f2afa6241b3fece1c84b242fe9eb309267)
- `10:49` **Fix download progress: show cumulative bytes across all shards** — +44 −21 — [`2896a3d`](https://github.com/abgnydn/fused-lora/commit/2896a3dc50d5fbfa1d0138fe842c73fcce79e581)
- `10:45` **Redesign chat UI: progress bar, byte-level download, unified layout** — +441 −134 — [`789be41`](https://github.com/abgnydn/fused-lora/commit/789be41d8cfd26039e5eaace7c2f9d5b26c15a37)
- `09:57` **Add OG image, favicon, meta tags; switch accent to emerald (#10b981)** — +124 −31 — [`8a32582`](https://github.com/abgnydn/fused-lora/commit/8a3258267703537ae71e697e5252803b49cac4af)

## 2026-04-07

- `17:15` **Polish landing page: card accents, comparison wrapper, link hierarchy** — +170 −97 — [`481b8e5`](https://github.com/abgnydn/fused-lora/commit/481b8e5068e555f08929e73c182f463f7e85b676)
- `16:05` **Remove live demo from demo.html, unify UI across all pages** — +33 −149 — [`06188c4`](https://github.com/abgnydn/fused-lora/commit/06188c4b6bd6e1d167f084a0b8706a4895513798)
- `15:34` **Add share modal with pre-filled messages for X, LinkedIn, HN, Reddit** — +107 −0 — [`fcf601f`](https://github.com/abgnydn/fused-lora/commit/fcf601fbba24f273c7ccb150578a9c2297b6d942)
- `15:22` **Update README with image and project description** — +2 −0 — [`4a603e1`](https://github.com/abgnydn/fused-lora/commit/4a603e1d297986c0d1636ecf7ec215d1cb4c28f3)
- `15:13` **Clarify browser requirement: explain enable f16 is the blocker** — +2 −1 — [`33808bb`](https://github.com/abgnydn/fused-lora/commit/33808bbafe876489efed8cdcb229334eade7cdb0)
- `15:06` **Gate model download behind "Download & Start" button** — +64 −9 — [`8e68677`](https://github.com/abgnydn/fused-lora/commit/8e68677a72f6adf11bb25171501df051b1fb278f)
- `15:02` **Fix demo.html: correct stats, we→I, unify nav/footer with landing page** — +16 −11 — [`e95d013`](https://github.com/abgnydn/fused-lora/commit/e95d013ca78635d738db4bf9eebebb8e78b24568)
- `14:53` **Add GitHub star link + related projects to landing page footer** — +5 −0 — [`b6d047c`](https://github.com/abgnydn/fused-lora/commit/b6d047c698038dc0d394a8b3a2b3a1bc4f83d0e0)
- `14:47` **Landing page: thesis + numbers + Try It button** — +136 −31 — [`8b7f2e9`](https://github.com/abgnydn/fused-lora/commit/8b7f2e973a231ee5abd3d248f119c63cae39cf47)
- `14:30` **Fix 5 runtime caveats in zero-tvm decode engine** — +76 −44 — [`582bb22`](https://github.com/abgnydn/fused-lora/commit/582bb2215f5969b388949b12a361fe56a7630cfe)

## 2026-04-05

- `14:36` **README: audit all claims against source, correct inaccuracies** — +58 −38 — [`12b7877`](https://github.com/abgnydn/fused-lora/commit/12b7877128fde4af16190aadbd16943c8ae1e44a)
- `13:26` **README: fill in real GitHub URL in citation block** — +1 −1 — [`e9018e0`](https://github.com/abgnydn/fused-lora/commit/e9018e0f701cf184a3f106b7566b9dbcab308660)
- `13:25` **Prepare for public release** — +328 −3821 — [`ffdf384`](https://github.com/abgnydn/fused-lora/commit/ffdf384742530d0a08ef06bc52abe4d5dfbe8c82)

## 2026-04-03

- `15:26` **Fix rope binding order in zero-tvm chat: q_out, k_out, v_out, qkv, po…** — +2 −1 — [`12818ec`](https://github.com/abgnydn/fused-lora/commit/12818ec07d6836593f3fd85f71eb645f17f281ea)
- `11:25` **Fix residual buffer aliasing: ping-pong between residual/residual2** — +17 −14 — [`46c9524`](https://github.com/abgnydn/fused-lora/commit/46c952457e8d3041cbafe3945418dd5d253b4346)
- `11:13` **Fix MLC parameter names: transformer.h.N.mixer.* not model.layers.N.*** — +47 −29 — [`2d66df7`](https://github.com/abgnydn/fused-lora/commit/2d66df72c46cc8ff5473c93d5fe2d9ab40f659e2)
- `10:47` **Zero-TVM chat: weight loader, BPE tokenizer, standalone inference** — +1033 −2 — [`6bb7ff3`](https://github.com/abgnydn/fused-lora/commit/6bb7ff34bf177ab8f46b8876df2149b9be6905a3)
- `10:07` **342/342 own shaders: wire in custom KV append + attention, fix captur…** — +83 −49 — [`f47e36a`](https://github.com/abgnydn/fused-lora/commit/f47e36a453bb16574a8a96defd053b28497c3cae)
- `09:34` **Enable fused FFN: verified correctness against TVM reference shaders** — +7 −3 — [`8726b9b`](https://github.com/abgnydn/fused-lora/commit/8726b9b76d04031cb36c06948ce5f32f3bf55c41)
- `09:32` **Capture prefill dispatches, full chat in Phi3Engine, improved fused FFN** — +1054 −237 — [`d743866`](https://github.com/abgnydn/fused-lora/commit/d743866fe4e8daa678dd41afc33a3fbac55f8856)
- `09:32` **Add shader analysis notes** — +1 −0 — [`bc3f9c7`](https://github.com/abgnydn/fused-lora/commit/bc3f9c78aecfc0197fb41c33208d6e02704f305b)
- `09:32` **Engine v3: capture-replay hybrid with zero-TVM decode path** — +308 −0 — [`fc080b5`](https://github.com/abgnydn/fused-lora/commit/fc080b5e94972de3ac4091cfc407326c9efca62e)
- `09:31` **Compiler-based engine: full from-scratch WebGPU inference** — +3156 −0 — [`01599a6`](https://github.com/abgnydn/fused-lora/commit/01599a636059120eaaadb172f85ad2e672115466)
