# Commits — webgpu-dna

## 2026-07-28

- `09:56` **docs: fix 6 numbers/consistency issues found by the merge-audit workflow** — +13 −11 — [`bed5c3f`](https://github.com/abgnydn/webgpu-dna/commit/bed5c3f8e1de626897c43dceb26bd6a969707aa3)
- `09:44` **docs: reconcile stale SSB_P_DIRECT references to the shipped model** — +7 −5 — [`ce4adbd`](https://github.com/abgnydn/webgpu-dna/commit/ce4adbdd098d3e70fae06dda70f960a05bc2c3f2)
- `09:41` **docs(changelog): record the integrated work under [Unreleased]** — +30 −1 — [`9d2efcd`](https://github.com/abgnydn/webgpu-dna/commit/9d2efcd6fd6da1dac3bb3965079f7cd1aee0f331)
- `09:38` **Merge remote-tracking branch 'origin/docs/claim-verification-fixes' i…** — +9 −9 — [`e48ddcc`](https://github.com/abgnydn/webgpu-dna/commit/e48ddcca83acf18ca09f32023c500c25cc632e9c)
- `09:36` **Merge remote-tracking branch 'origin/docs/reconcile-numbers' into int…** — +27 −13 — [`d1b8ce3`](https://github.com/abgnydn/webgpu-dna/commit/d1b8ce3aa0467f13ee3409ac5f81257e97dd6381)
- `09:34` **Merge remote-tracking branch 'origin/ci/activate-webgpu-smoke' into i…** — +22 −20 — [`ec35ec7`](https://github.com/abgnydn/webgpu-dna/commit/ec35ec770ff5000985c2403b10c10cb8519c7a38)
- `09:34` **Merge remote-tracking branch 'origin/chore/drop-test-count-vanity-met…** — +5 −16 — [`66abc3d`](https://github.com/abgnydn/webgpu-dna/commit/66abc3d90509637d4377dbc3d7d6629b4459bdcc)
- `09:34` **Merge remote-tracking branch 'origin/feat/direct-ssb-accumulated' int…** — +563 −73 — [`c4e1f17`](https://github.com/abgnydn/webgpu-dna/commit/c4e1f174062e84f533537a08f78197ca3d14c5d3)
- `09:34` **Merge remote-tracking branch 'origin/fix/gpu-chem-onsager-sign' into …** — +8 −3 — [`b509279`](https://github.com/abgnydn/webgpu-dna/commit/b509279ef73c817e8be88d375c0ee35cbe3f1229)
- `09:34` **Merge remote-tracking branch 'origin/feat/webgpu-robustness' into int…** — +63 −11 — [`db094fa`](https://github.com/abgnydn/webgpu-dna/commit/db094fa50ddea8be44bf02ba5e5d525993e060d9)

## 2026-07-13

- `07:05` **docs: fix line-57 test-count straggler (46/7 -> 50/9)** — +1 −1 — [`9c3443c`](https://github.com/abgnydn/webgpu-dna/commit/9c3443cba1fe3ef46f491fd16710620637213e20)
- `07:04` **docs: fix 7 stale §Numbers claims flagged by the claim-verification loop** — +11 −11 — [`a440d50`](https://github.com/abgnydn/webgpu-dna/commit/a440d50f659618d3668227545ea42b13bf31ecac)

## 2026-07-06

- `12:59` **docs(tunables): summary line — direct model is accumulated-volume** — +3 −3 — [`0353427`](https://github.com/abgnydn/webgpu-dna/commit/0353427b069dd25e618fe8232759ff2c516f47ac)
- `12:58` **feat(scoring): accumulated-volume direct-SSB model + refute accumulat…** — +88 −26 — [`b1a6f37`](https://github.com/abgnydn/webgpu-dna/commit/b1a6f376c8e2016f7667fa5da44e068219ea1f99)
- `08:04` **feat(scoring): energy-threshold direct-SSB model (rigorous, no calibr…** — +276 −36 — [`865cdf5`](https://github.com/abgnydn/webgpu-dna/commit/865cdf5b21a4aea2660c246b369c9c08aa8dabf2)
- `07:12` **scoring: pin parameter-free SSB ratio on a fresh v0.7.0 GPU dump** — +26 −14 — [`d505872`](https://github.com/abgnydn/webgpu-dna/commit/d505872a31664831869df4ca67568e172e881477)
- `06:51` **fix(scoring): make DNA-damage scoring parameter-free (remove calibrat…** — +83 −29 — [`67dd54b`](https://github.com/abgnydn/webgpu-dna/commit/67dd54b1a03cf7d38b70825ded9c7e6b194f4e69)
- `05:43` **docs: reconcile headline numbers with committed artifacts** — +28 −14 — [`fceec6b`](https://github.com/abgnydn/webgpu-dna/commit/fceec6bb1f0e67a4c3a896d24dd8671916ee0636)
- `05:38` **fix(chem): correct sign of Onsager radius in the non-production IRT b…** — +8 −3 — [`77b6641`](https://github.com/abgnydn/webgpu-dna/commit/77b664102b9ea06147102bdd2cb8898fd3461da1)
- `05:34` **feat(gpu): device-lost recovery, buffer reclamation, and np clamping** — +63 −11 — [`6c2d06a`](https://github.com/abgnydn/webgpu-dna/commit/6c2d06abff2aa43d582e01af7bd763eb5eb1fa9f)
- `05:24` **fix(scoring): correct direct-SSB over-count in the production scorer** — +139 −17 — [`da81c05`](https://github.com/abgnydn/webgpu-dna/commit/da81c05d0eac4253e80077c4e3a24961edb520cf)

## 2026-07-02

- `07:20` **ci: activate headless WebGPU smoke workflow** — +22 −20 — [`257ee9c`](https://github.com/abgnydn/webgpu-dna/commit/257ee9c39e15d9dc79a2f630750e0d64007777ec)

## 2026-07-01

- `12:31` **fix(scoring): correct 10x strand-1 dose over-count in reference scorer** — +7 −3 — [`39632a3`](https://github.com/abgnydn/webgpu-dna/commit/39632a331d9f9e88771b7711835a98a45504d010)
- `12:26` **docs: drop the test-count vanity metric** — +5 −16 — [`08b6070`](https://github.com/abgnydn/webgpu-dna/commit/08b60708af1074b836b9f35cc5cb0a085b41a379)

## 2026-06-23

- `08:34` **Merge pull request #1 from abgnydn/claude/nice-gauss-ssp1c4** — +1167 −154 — [`2135979`](https://github.com/abgnydn/webgpu-dna/commit/2135979189ae01957cc8eee8efba4588011542f7)
- `07:47` **colab(phase-a): self-contained Vulkan install (loader + tools + produ…** — +8 −0 — [`411d298`](https://github.com/abgnydn/webgpu-dna/commit/411d298fc10e4c8f233699b3eb4a091a42f365f2)
- `07:40` **colab: force WGPU_BACKEND_TYPE=Vulkan (GL backend can't do compute st…** — +17 −4 — [`c42be78`](https://github.com/abgnydn/webgpu-dna/commit/c42be785d82b2c63471a3c96b8f9ad7668c30a87)
- `06:43` **colab: Phase A host port (wgpu-py) — real primaries on the T4** — +200 −0 — [`6d61662`](https://github.com/abgnydn/webgpu-dna/commit/6d61662cea906f148bbf44d9b2349791f8e998a0)
- `06:30` **finding(B2): Colab/Kaggle T4 RUNS WebGPU — FREE_COMPUTE.md §3 overturned** — +88 −22 — [`338e658`](https://github.com/abgnydn/webgpu-dna/commit/338e65891104e85843a725be5b9eba587dab2fd8)
- `06:19` **colab: fix wgpu compute typecode (u32->I), make shader-validate the P…** — +18 −7 — [`94a5612`](https://github.com/abgnydn/webgpu-dna/commit/94a56127249ae9fc52df9830a6bbb74e08c368b0)
- `03:27` **chore: gitignore __pycache__ + drop accidentally committed .pyc** — +4 −0 — [`5670805`](https://github.com/abgnydn/webgpu-dna/commit/5670805bac09a8b3027d7453b08e16a666b1c4e4)
- `03:27` **colab: real-GPU WebGPU attempt + shader validation via wgpu-py** — +213 −0 — [`1a066e5`](https://github.com/abgnydn/webgpu-dna/commit/1a066e5e59306e64bebad5a46dbe3c7367fe14d3)
- `03:15` **ci: stage webgpu-smoke workflow under ci/ (token lacks workflow scope)** — +87 −1 — [`2b1ab11`](https://github.com/abgnydn/webgpu-dna/commit/2b1ab1186567edd89b8d15589ee2a919ce827b30)
- `03:12` **ci: headless WebGPU smoke — run the real WGSL shaders on a software a…** — +143 −1 — [`1a7783f`](https://github.com/abgnydn/webgpu-dna/commit/1a7783f8d6017669c50f41626a7c387a6a73fcbb)
- `03:03` **docs: close the remaining critique items (tunables, L5, perf, chem6, …** — +81 −13 — [`d43a618`](https://github.com/abgnydn/webgpu-dna/commit/d43a6181841d1840ef98035cced92b228e95ef5b)
- `02:13` **test: add three CI guardrails against the recurring failure classes** — +219 −11 — [`1c9563b`](https://github.com/abgnydn/webgpu-dna/commit/1c9563bc8f34d0ee0d2c79007406a14651ebccae)
- `01:47` **chore: apply the README + .gitignore Vercel removals** — +1 −7 — [`4d70594`](https://github.com/abgnydn/webgpu-dna/commit/4d705947582ba49be110d53e447f584a1ed52142)
- `01:45` **chore: remove leftover Vercel config (production is Cloudflare Pages)** — +0 −11 — [`c43e796`](https://github.com/abgnydn/webgpu-dna/commit/c43e79606b19c3ec53f315faa288bfe55692ac2c)
- `01:10` **docs: correct overstated claims, reconcile versions, add reproducibil…** — +107 −96 — [`71a9194`](https://github.com/abgnydn/webgpu-dna/commit/71a9194038ecf2a69b7573735a4d780f7e69bfeb)

## 2026-06-10

- `05:04` **experiment(E37): 100 keV proton ranges 2x too far (2.65 vs G4 1.2 / P…** — +16 −0 — [`d0921b7`](https://github.com/abgnydn/webgpu-dna/commit/d0921b767ba58e3f7ba57e636b0e504b70f5d94f)
- `05:00` **experiment(E36): causal isolation — IRT engine is CORRECT; deficit is…** — +14858 −13 — [`5362833`](https://github.com/abgnydn/webgpu-dna/commit/5362833d36aebc65582c285fba025553a10f42ab)
- `04:04` **experiment(E35): diagnose the oxygen discrepancy -> high-LET recombin…** — +15 −0 — [`d0e830f`](https://github.com/abgnydn/webgpu-dna/commit/d0e830fc72b976b8bab6484cbdfbb7b20305ca49)

## 2026-06-09

- `15:24` **experiment(E34): validate oxygen network vs the REAL option3 oracle —…** — +21 −0 — [`51ad614`](https://github.com/abgnydn/webgpu-dna/commit/51ad6141b8e4fd44c3a77d6acf3a213aeded3a30)
- `13:38` **chore: commit run_irt_ssb.cjs O2 wiring (arg6 µM) used for the E33 OE…** — +2 −1 — [`8fdb05d`](https://github.com/abgnydn/webgpu-dna/commit/8fdb05dcb3cef7da8c33046ee79ade999d39daf0)
- `13:37` **experiment(E33): damage-level OER is ~1.0 (honest negative) — needs D…** — +15 −0 — [`8529bab`](https://github.com/abgnydn/webgpu-dna/commit/8529bab40c30d225115eb6eb8a5af7927d88d42e)
- `13:19` **feat(chem): dissolved O2 (the oxygen effect / OER) — dose-dependent e…** — +46 −1 — [`1851ee1`](https://github.com/abgnydn/webgpu-dna/commit/1851ee12fe1e635c8c38af3121d1d588467aca2b)
- `13:14` **fix(proton): G4DNARuddAngle ejection angle, replacing today's isotrop…** — +13 −4 — [`1b37fef`](https://github.com/abgnydn/webgpu-dna/commit/1b37fefe78b055dae691da62d469177879eb5a60)
- `13:08` **experiment(E31): oxygen network functional + LET effect is textbook-c…** — +23 −0 — [`1d35f7a`](https://github.com/abgnydn/webgpu-dna/commit/1d35f7a23efe13b5b915e002b1231026a3d24e2a)
- `12:55` **feat(chem): wire the O(3p) seed -> oxygen network is ALIVE (first oxy…** — +38 −14 — [`bd6351d`](https://github.com/abgnydn/webgpu-dna/commit/bd6351d653dbfd54d42a00ecb362382791bb6f9f)
- `12:43` **feat(chem): port option3 oxygen network into the IRT worker (38 react…** — +51 −7 — [`a0e613e`](https://github.com/abgnydn/webgpu-dna/commit/a0e613e9e12ad504aa381e33692d4da3c36404c0)
