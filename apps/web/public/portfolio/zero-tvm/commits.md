# Commits — zero-tvm

## 2026-07-29

- `09:13` **Merge pull request #26 from abgnydn/space-card-refresh** — +2 −2 — [`f566963`](https://github.com/abgnydn/zero-tvm/commit/f5669635e477f606f69d5ce07932857f54ff05b8)
- `09:11` **docs(space): refresh the HF Space card to the current measured pairs** — +2 −2 — [`895a501`](https://github.com/abgnydn/zero-tvm/commit/895a501a5525e0737c70ed9daa389125dcb28482)
- `08:09` **Merge pull request #25 from abgnydn/qwen3-tuning** — +715 −144 — [`1fd54b3`](https://github.com/abgnydn/zero-tvm/commit/1fd54b3d395628adad70a410675d8712aed57033)
- `08:07` **perf(qwen3): fused qk_norm+rope+append kernel + K%512 vec4 — 75.74 to…** — +715 −144 — [`43a5e99`](https://github.com/abgnydn/zero-tvm/commit/43a5e99edc34f587db473c034377e753b75968cc)
- `07:32` **Merge pull request #24 from abgnydn/prefill-reuse** — +1739 −52 — [`49c3c14`](https://github.com/abgnydn/zero-tvm/commit/49c3c144f033742e1d90d23642db5717f766453d)
- `07:30` **perf: chunked GDN prefill (3x) + cross-turn prefix reuse (TTFT 15s ->…** — +1739 −52 — [`2096734`](https://github.com/abgnydn/zero-tvm/commit/209673467b9be4429cbd99006dc081f68caa5cd7)
- `05:34` **Merge pull request #23 from abgnydn/hybrid-perf** — +336 −123 — [`305595d`](https://github.com/abgnydn/zero-tvm/commit/305595dbfefa3505c45eca6c98581abaea9e3c57)
- `05:32` **perf(qwen35): GDN projection fusion 4->1 + no-replay blocking decode …** — +336 −123 — [`099787d`](https://github.com/abgnydn/zero-tvm/commit/099787d51b472419806de476c92828eaea5afc87)

## 2026-07-28

- `13:38` **Merge pull request #22 from abgnydn/qwen35** — +2537 −136 — [`7a66144`](https://github.com/abgnydn/zero-tvm/commit/7a6614442bef6ff4688347cd61c6e8702f9a0307)
- `13:36` **feat(qwen35): measured +50% vs WebLLM 0.2.84 on the hybrid; docs acro…** — +225 −37 — [`9e75b87`](https://github.com/abgnydn/zero-tvm/commit/9e75b8786e9a74458f2ba7232c48f565816666e6)
- `13:13` **feat(qwen35): end-to-end hybrid wiring — ?model=qwen35 generates corr…** — +529 −85 — [`1adcc56`](https://github.com/abgnydn/zero-tvm/commit/1adcc56aa96ffe2b0bd1ed87dad197e99d9f43b4)
- `12:41` **feat(qwen35): gated-DeltaNet kernel family + CPU reference + 13-test …** — +1787 −18 — [`de0cfc3`](https://github.com/abgnydn/zero-tvm/commit/de0cfc34898f94865185617f8db9f1c713a768aa)
- `10:13` **Merge pull request #21 from abgnydn/harden-downloads** — +438 −61 — [`fa66a8f`](https://github.com/abgnydn/zero-tvm/commit/fa66a8fde738180cdc32c784dd41be12debd8112)
- `10:11` **fix(loader): survive mid-stream HTTP2 resets — retry body reads, Rang…** — +438 −61 — [`8c2b9af`](https://github.com/abgnydn/zero-tvm/commit/8c2b9af51850260bc323976611a7a5e177ea714c)
- `09:49` **Merge pull request #20 from abgnydn/fix-gate-stats** — +6 −4 — [`e49e7b3`](https://github.com/abgnydn/zero-tvm/commit/e49e7b3a18de33e87dfba9dfa2cc712239a8d602)
- `09:47` **fix(chat): gate dialog throughput stat is model-aware — Qwen showed P…** — +6 −4 — [`4a47049`](https://github.com/abgnydn/zero-tvm/commit/4a47049b2f93e6f36b3988951cba4d30ca661588)
- `09:24` **Merge pull request #19 from abgnydn/qwen-site-docs** — +58 −3 — [`95074c6`](https://github.com/abgnydn/zero-tvm/commit/95074c67d29ac473a176687f4aaa020c59eb8b8e)
- `09:23` **docs: surface the Qwen3-4B port on landing page, docs page, and HF Sp…** — +58 −3 — [`f03946b`](https://github.com/abgnydn/zero-tvm/commit/f03946b3b5bba5d005d5944f8a6b65ab84a3305e)
- `09:13` **Merge pull request #18 from abgnydn/qwen3** — +4288 −564 — [`db0b787`](https://github.com/abgnydn/zero-tvm/commit/db0b787750d0eb32d3c121f140960c8ff9da1a40)
- `09:10` **feat(qwen3): same-weights A/B vs WebLLM (+80%), Qwen e2e, honest docs** — +338 −23 — [`2acc360`](https://github.com/abgnydn/zero-tvm/commit/2acc36032630f40c50bdb78d6fee008e60eeb748)
- `08:54` **fix(qwen3): request adapter buffer limits in browser boot — first wor…** — +25 −1 — [`d3ed34b`](https://github.com/abgnydn/zero-tvm/commit/d3ed34be2bc5cb324f9286198fcc34ec645ab8ed)
- `08:44` **feat(qwen3): end-to-end wiring — ?model=qwen3 on chat + validate** — +325 −84 — [`2870e7e`](https://github.com/abgnydn/zero-tvm/commit/2870e7e53f07c1b8adb4dab622d0f2fa184c31d9)
- `08:24` **feat(qwen3): GQA-correct kernels + QK-norm + Qwen correctness suite (…** — +1414 −313 — [`50d216f`](https://github.com/abgnydn/zero-tvm/commit/50d216f30887cf5dd9e42b3a0d081e4f5834f26c)
- `07:31` **feat(qwen3): model-spec parameterized engine + Qwen byte-level BPE to…** — +2260 −217 — [`ab13fc3`](https://github.com/abgnydn/zero-tvm/commit/ab13fc38dcac7e64d413e99fe44055ca805dc34b)
- `06:28` **Merge pull request #17 from abgnydn/sync-numbers-everywhere** — +277 −59 — [`df687cc`](https://github.com/abgnydn/zero-tvm/commit/df687cc76b62f332fdad26942a49adda70589804)
- `06:26` **chore: single-source bench numbers everywhere + HF Space auto-deploy** — +277 −59 — [`2705188`](https://github.com/abgnydn/zero-tvm/commit/2705188648797ee8812fbeb8daac725d586af445)
- `06:13` **Merge pull request #16 from abgnydn/max-improvements** — +100539 −4062 — [`5f3abcf`](https://github.com/abgnydn/zero-tvm/commit/5f3abcf2f4b744a09cd09a435cb7c61b8e882981)
- `06:07` **feat: split-K default after long-context A/B; e2e suite green end-to-end** — +107 −53 — [`9a16cae`](https://github.com/abgnydn/zero-tvm/commit/9a16cae4cbcf13ed0b4a9893426f014cd5904f96)

## 2026-07-25

- `07:51` **perf: vec4 loads default-on (+7% measured); new headline — 28% faster…** — +408 −244 — [`5cd288d`](https://github.com/abgnydn/zero-tvm/commit/5cd288d6031e88e71fe632b2f7dec6069e0787e4)

## 2026-07-24

- `08:43` **fix(shaders): barrier after cross-iteration score_reduce read in atte…** — +10 −0 — [`12e696c`](https://github.com/abgnydn/zero-tvm/commit/12e696ce21ed208aa5c249661d827fc79c810c2d)
- `06:51` **feat(perf): three opt-in experiments — vec4 loads, split-K attention,…** — +1606 −46 — [`713dccb`](https://github.com/abgnydn/zero-tvm/commit/713dccb2d0f8541d85be6f232ab9eb958f011464)
- `06:19` **refactor(engine): one decode engine — chat.ts becomes a thin page module** — +1419 −2002 — [`4eea2f4`](https://github.com/abgnydn/zero-tvm/commit/4eea2f4c1df4a9adaf02dbac1446bc631b842802)
- `05:47` **refactor(shaders): named constants from one PHI3 source + int4_matmul…** — +1142 −1639 — [`7a1df37`](https://github.com/abgnydn/zero-tvm/commit/7a1df37ac67703bb25a4e6f040ea533bb8144922)
- `05:19` **test: real CI verification — kernel job, tokenizer rewrite + 116 unit…** — +95934 −261 — [`8434845`](https://github.com/abgnydn/zero-tvm/commit/8434845e83adafbbece319dbaf449bc1f8002dba)
- `05:05` **fix: correctness sweep — OPFS cache war, decode off-by-one, fused_ffn…** — +208 −112 — [`c753ac4`](https://github.com/abgnydn/zero-tvm/commit/c753ac4fc4cf1b32caa7c593942cbb699719dd26)

## 2026-06-25

- `03:44` **docs: add Zenodo DOI badge + CITATION.cff identifier (#15)** — +9 −9 — [`32406c8`](https://github.com/abgnydn/zero-tvm/commit/32406c88acc201694df83a4e22df64bf4391d380)
- `03:14` **docs(zenodo): tighten deposit metadata for a clean DOI record (#14)** — +2 −4 — [`1c8ce0f`](https://github.com/abgnydn/zero-tvm/commit/1c8ce0f03d6c8b7ad63fff508f2aeb91514a1eb4)
- `03:05` **chore: bump to 0.2.0 for a fresh release (#13)** — +37 −2 — [`7f2d6f2`](https://github.com/abgnydn/zero-tvm/commit/7f2d6f2c65524448a46a9c96208dc28e3907b94b)
- `03:02` **docs: add Zenodo .zenodo.json + CITATION.cff for a citable DOI (#12)** — +64 −3 — [`bda3f67`](https://github.com/abgnydn/zero-tvm/commit/bda3f6777a3180bbeb20a7d6c48d67af789f0361)
- `02:58` **docs(readme): replace stale v1 screenshot with current hero (#11)** — +1 −1 — [`9bf9fef`](https://github.com/abgnydn/zero-tvm/commit/9bf9fef60d2fd55fd8a2d40a9eef2a9c285e6ffe)
- `02:47` **docs(readme): lead with the comparison table + headline number (#10)** — +11 −15 — [`dc21078`](https://github.com/abgnydn/zero-tvm/commit/dc21078010d280becd6f694d454a74f750383169)
- `02:40` **docs(readme): fix stale main.ts ref, document test suite + bench (#9)** — +17 −5 — [`9661b9b`](https://github.com/abgnydn/zero-tvm/commit/9661b9ba351347c2c555ae569f6fdf20f0ee0b25)

## 2026-06-23

- `07:47` **fix(bench): WebGPU adapter on T4 — disable Dawn adapter blocklist (#8)** — +22 −14 — [`35955bd`](https://github.com/abgnydn/zero-tvm/commit/35955bd3e2ff50a6cca69bf42c774aae73613300)
- `07:06` **fix(bench): instrument boot to pinpoint the hang (#7)** — +53 −11 — [`4b8f833`](https://github.com/abgnydn/zero-tvm/commit/4b8f8334e1ade0f64c917b6ac56c6ece933443b2)
- `03:49` **fix(bench): bind dev server to 127.0.0.1 — Colab localhost/IPv6 timeo…** — +12 −4 — [`95e7e03`](https://github.com/abgnydn/zero-tvm/commit/95e7e0386d67657fcc51294e211fc027577502a7)
- `03:28` **fix(bench): clean Colab re-run — fresh clone + T4-only (#5)** — +2 −2 — [`d7dc57d`](https://github.com/abgnydn/zero-tvm/commit/d7dc57d648dedf2862472849fb5913a3baa44937)
- `03:08` **fix(bench): get the real T4 on Colab — libnvidia-gl + ANGLE/Vulkan fl…** — +12 −4 — [`2a9dd1e`](https://github.com/abgnydn/zero-tvm/commit/2a9dd1e3f1ec3f833b0d066392ce2d0f8ba5a1a0)
- `03:01` **fix(bench): abort on software GPU, use hf instead of huggingface-cli …** — +22 −7 — [`be8dacf`](https://github.com/abgnydn/zero-tvm/commit/be8dacf1999fc51e7787c05957305fa5f6c70d84)
- `02:49` **Add one-click Colab notebook for the GPU bench (#2)** — +36 −0 — [`6a32c63`](https://github.com/abgnydn/zero-tvm/commit/6a32c638033e73872a2f031730c5a6238a532c8b)
- `02:23` **Critique fixes: prune dead code, headless WebGPU kernel tests, bench …** — +1108 −1142 — [`2d8c839`](https://github.com/abgnydn/zero-tvm/commit/2d8c839e11986b7ac196328ccfd8cce444a241df)
