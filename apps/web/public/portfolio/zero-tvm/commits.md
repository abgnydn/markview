# Commits — zero-tvm

## 2026-08-10

- `01:12` **colab: the notebook has now been run, and it found a path bug in this…** — +20 −37 — [`83b8817`](https://github.com/abgnydn/zero-tvm/commit/83b881776501b9520289fff5c1e4996d3f12c3a5)
- `00:08` **colab: build the MoE-layer bundle where the bandwidth is** — +756 −31 — [`f4ec090`](https://github.com/abgnydn/zero-tvm/commit/f4ec090facf29b2d9434748309ef7de1fcf15130)
- `00:06` **chat: sampling controls in the header** — +290 −15 — [`e4cdea1`](https://github.com/abgnydn/zero-tvm/commit/e4cdea1b04adc731ef3400ec6d0fd9c55453e2c7)

## 2026-08-09

- `14:24` **sampler: temperature, top-p and min-p** — +572 −5 — [`3e71c4b`](https://github.com/abgnydn/zero-tvm/commit/3e71c4b0d43530c62d0978b21b246329741d15e3)
- `14:02` **review: four defects an adversarial pass found, three of which I had …** — +55 −10 — [`96046f5`](https://github.com/abgnydn/zero-tvm/commit/96046f53fabddaba664ea9505db203cc3d587399)
- `13:53` **lib: an entry point someone else can import** — +383 −1 — [`3775ba2`](https://github.com/abgnydn/zero-tvm/commit/3775ba2afc215e39632d18f6506444e0bb6c278b)
- `12:48` **mla: a whole DeepSeek attention layer, on real weights, seven stages** — +165 −2 — [`689be67`](https://github.com/abgnydn/zero-tvm/commit/689be67442c893c2a68b9c7108154b007d014dd9)
- `12:26` **mla: DeepSeek's interleaved RoPE costs nothing at runtime** — +36 −0 — [`512c0e0`](https://github.com/abgnydn/zero-tvm/commit/512c0e0cd983e5bbb64922a3d70ddef59d1666d7)
- `12:22` **mla: a whole DeepSeek layer as a reference, RoPE and all** — +203 −0 — [`fee83cd`](https://github.com/abgnydn/zero-tvm/commit/fee83cd4a27ebc1877fc0a9a3d1bfbbb6b473c39)
- `12:19` **mla-ref: dequantize without mlx, bit-identically** — +66 −4 — [`8f85ea8`](https://github.com/abgnydn/zero-tvm/commit/8f85ea82e44ffb2e73961bcf70c7fde503459c7e)
- `12:08` **pull-tensors: resume, and fetch in chunks** — +34 −7 — [`d3937d3`](https://github.com/abgnydn/zero-tvm/commit/d3937d374b660ce3e746204324f50a63d2a4ee2d)
- `11:56` **spec: a stack can mix dense and MoE layers** — +109 −3 — [`d7810b3`](https://github.com/abgnydn/zero-tvm/commit/d7810b35dc9e96a2363571078bb0b74b9ec8107d)
- `11:52` **deepseek: the bare router loads, and the chat template renders** — +164 −15 — [`4a064c5`](https://github.com/abgnydn/zero-tvm/commit/4a064c5fa7aaf2aeefab50316c05b428230ce5fb)
- `11:16` **moe: a router the quantizer skipped** — +115 −21 — [`f8e6a4d`](https://github.com/abgnydn/zero-tvm/commit/f8e6a4da6f71ce27ae0379e9096d93358175ebd2)
- `11:10` **mla: the whole chain on the GPU, not just the attention** — +104 −5 — [`80eb68b`](https://github.com/abgnydn/zero-tvm/commit/80eb68b0448cfd70ae61d07bacd19b8d996ffc73)
- `11:02` **rope: yarn, checked against DeepSeek's own helpers** — +301 −12 — [`b6d7da4`](https://github.com/abgnydn/zero-tvm/commit/b6d7da49b5056e1200675f55a07f6521ffa5a56f)
- `10:49` **mla: the attention kernel, checked against a real DeepSeek layer** — +247 −12 — [`cd79bdb`](https://github.com/abgnydn/zero-tvm/commit/cd79bdb99c6ad9c653bb3fc1341bd62a5b29830a)
- `10:33` **mla: a real-weights reference, from 7.7 MB instead of 9 GB** — +268 −0 — [`1073c49`](https://github.com/abgnydn/zero-tvm/commit/1073c4962616171d294758f63f3930b61b8a4e82)
- `09:46` **add-model: describe DeepSeek instead of guessing at it, and stop trea…** — +98 −12 — [`3029dbe`](https://github.com/abgnydn/zero-tvm/commit/3029dbe872f441265bde11a0e01b05292b1a457a)
- `09:20` **add-model: refuse config fields we do not read** — +85 −1 — [`5fc63c4`](https://github.com/abgnydn/zero-tvm/commit/5fc63c4f00b55088e49c9beeaf865fe2210a2187)
- `07:26` **rooms: a model can span any number of machines, not two** — +274 −114 — [`dbdf750`](https://github.com/abgnydn/zero-tvm/commit/dbdf750b6ef5ed36ad672c666959a9edd7252932)

## 2026-08-08

- `02:20` **split: there was no bug — the model was undecided** — +67 −18 — [`c32ad33`](https://github.com/abgnydn/zero-tvm/commit/c32ad33604099e49bc6acd16a86546a4a0d9ba52)
- `02:06` **split: a stage must answer what the whole model answers** — +85 −9 — [`5a42b4f`](https://github.com/abgnydn/zero-tvm/commit/5a42b4f1a5d186ea82f7e5c297de04818a9dbd67)
- `01:39` **bench: what does cutting a model in half actually cost?** — +170 −0 — [`ad738c9`](https://github.com/abgnydn/zero-tvm/commit/ad738c94af542299e5634768fff49682c5aa3b69)
- `00:12` **models: Qwen3-30B-A3B — MoE without a shared expert, and a 4-bit router** — +414 −57 — [`6fcda67`](https://github.com/abgnydn/zero-tvm/commit/6fcda675eb58d2d43fc925a125997833518ad05b)
- `00:11` **mlx-ref: grade in f32 — bf16 was noisier than the engine it graded** — +15 −0 — [`620979d`](https://github.com/abgnydn/zero-tvm/commit/620979d64061f25855becf7f0f34daa6e997489e)

## 2026-08-07

- `11:27` **docs: split serving in CLAUDE.md** — +15 −2 — [`00d6c9f`](https://github.com/abgnydn/zero-tvm/commit/00d6c9fbc7faefcd46b1221e85ce8ddb42b90b51)
- `11:27` **split serving: two browsers, half a model each, one answer** — +529 −44 — [`b5d13b4`](https://github.com/abgnydn/zero-tvm/commit/b5d13b41d484bb058d9fcecae4cffc0d9888d5cc)
- `07:43` **loader: a stage loads its own layers, not the whole checkpoint** — +111 −19 — [`f4198a2`](https://github.com/abgnydn/zero-tvm/commit/f4198a2ea05ec6494baf59fff48490a338d2815e)
- `07:37` **engine: run a layer range as one pipeline stage** — +263 −15 — [`347c006`](https://github.com/abgnydn/zero-tvm/commit/347c00605b2b496b2cf56b0a7512ddad2cb836a6)
- `07:22` **rooms: many hosts, least-loaded assignment, and takeover when one dies** — +357 −72 — [`95a3654`](https://github.com/abgnydn/zero-tvm/commit/95a36546071496c9ac066f751e0cc4344dd2878e)
- `06:54` **peer weights: a second device copies the model from the first, not fr…** — +632 −17 — [`c71f14c`](https://github.com/abgnydn/zero-tvm/commit/c71f14cd2489949ba0e40c0930429db85e04a90d)

## 2026-08-06

- `09:26` **share: the guest IS the chat page — surface extracted into chat-ui.{t…** — +787 −675 — [`e7e5b6c`](https://github.com/abgnydn/zero-tvm/commit/e7e5b6c9cae52ed86b65b56251d4e9d6a834eaac)
- `09:16` **models: Llama-3.2-1B-Instruct (?model=llama32) — first Llama on the e…** — +129 −6 — [`b1f75a5`](https://github.com/abgnydn/zero-tvm/commit/b1f75a53c2782eed624f988b5cb3e865916df2a7)
- `09:16` **mlx loader: convert by the header's dtype, not by assumption** — +18 −1 — [`8f33997`](https://github.com/abgnydn/zero-tvm/commit/8f33997044f20ffe4c52e41a19f198e060afef6a)
- `09:11` **share: reply budget = remaining context, not a 1024 cap** — +4 −1 — [`9eb0d9b`](https://github.com/abgnydn/zero-tvm/commit/9eb0d9be61b780782c02e6fddd2fcc1240fcf6ef)
- `09:01` **add-model: chat_template.jinja probe, llama3 detection, layer_types g…** — +79 −14 — [`0b0022b`](https://github.com/abgnydn/zero-tvm/commit/0b0022bcdce684232b9525067b07fcf0183fc380)
- `08:58` **share: stamp the deployed signaling URL (abgunaydin94.workers.dev)** — +1 −1 — [`e5180bf`](https://github.com/abgnydn/zero-tvm/commit/e5180bfca521af47c9d9183cb6f8285d2df0c080)
- `08:57` **chat: Llama-3 header template + tokenizer pipeline from the repo's ow…** — +1129 −8 — [`ded5eca`](https://github.com/abgnydn/zero-tvm/commit/ded5eca57808ae7c757030a6825d04d07c36e14b)
- `08:52` **rope: precomputed inv_freq table binding — llama3 rope_scaling support** — +103 −16 — [`cd4bf95`](https://github.com/abgnydn/zero-tvm/commit/cd4bf95896257af18bbbd0e83abb1858043d2572)
- `08:50` **share: serve the model in this tab to another device over WebRTC** — +704 −0 — [`3ddcd6d`](https://github.com/abgnydn/zero-tvm/commit/3ddcd6d307d4f1949615122344f1c965af2dcfb9)
- `08:10` **build: rotate asset URLs (hash:10) + real 404s — fix a poisoned edge …** — +39 −0 — [`27ec988`](https://github.com/abgnydn/zero-tvm/commit/27ec988ab790d29161131342165ce5133dc29030)
- `08:08` **registry: point at the validate step — and rotate a poisoned CDN URL** — +3 −1 — [`c8ef676`](https://github.com/abgnydn/zero-tvm/commit/c8ef6765cae9e01c511afd0a24495373c0e43899)
- `07:53` **add-model: one command from an MLX checkpoint to a registered, valida…** — +1259 −71 — [`869f90f`](https://github.com/abgnydn/zero-tvm/commit/869f90f263da251993b1bf255fa870d01e2f2de8)
- `07:53` **site: finish the plain-register revamp** — +61 −66 — [`b754c98`](https://github.com/abgnydn/zero-tvm/commit/b754c988d894affe854d24ad1e0f6e68dbea4381)

## 2026-08-05

- `15:08` **landing: say what it is, plainly** — +4 −6 — [`0a45bb4`](https://github.com/abgnydn/zero-tvm/commit/0a45bb443969accbcda15b3fa9c234ebd4caf913)
- `14:35` **fix(deploy-space): git-lfs actually engages now — -q is not a git-lfs…** — +9 −0 — [`b587595`](https://github.com/abgnydn/zero-tvm/commit/b5875959b5fc25ffd0fa2c09e821c63cdc5d70d6)
- `14:20` **Rebuild every surface around one rule: facts live in exactly one place** — +341 −813 — [`acf2bc2`](https://github.com/abgnydn/zero-tvm/commit/acf2bc22ff362a83b2aa55b4874c41a1e73e6165)
- `12:59` **Merge site-refresh (PR #29) + surface Qwen3.6 everywhere** — +278 −24 — [`d22f516`](https://github.com/abgnydn/zero-tvm/commit/d22f516e7368b47596c75937575be7e749f68c8c)
- `12:24` **fix(qwen36q3): hfRepo is abgunaydin/… — the HF account, not the GitHu…** — +2 −2 — [`600c1c5`](https://github.com/abgnydn/zero-tvm/commit/600c1c508c3cb1ea31035bd9c507a9e744a49d9a)
