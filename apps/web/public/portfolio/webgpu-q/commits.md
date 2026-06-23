# Commits — webgpu-q

## 2026-06-23

- `06:51` **Federated CCSD(T) foundation + first cross-vendor GPU validation + EO…** — +1375 −15 — [`cae5f1b`](https://github.com/abgnydn/webgpu-q/commit/cae5f1b8db8e6d8fb1d5f907d0a8a2e84319aea8)
- `06:25` **docs(swarm): measure (T) C/S scaling — it's flat, not ∝N (correct again)** — +33 −15 — [`7ff551a`](https://github.com/abgnydn/webgpu-q/commit/7ff551a89cc07e652ad087fc5b76ad053c238ef5)
- `06:21` **chore(gitignore): ignore _zzz-*.test.ts throwaway benchmark scratch** — +3 −0 — [`9ea267d`](https://github.com/abgnydn/webgpu-q/commit/9ea267d6bd9357cd1201c62a58ec24ab4de8dc69)
- `06:14` **docs(swarm): measure federated (T) regime — partial negative, correct…** — +94 −16 — [`60c1e1a`](https://github.com/abgnydn/webgpu-q/commit/60c1e1acca9b92e734e9e4cc3365f8f68c24dc97)
- `03:22` **test(e2e): federated CCSD(T) speedup crossover spec (swarm-ccsdt-spee…** — +143 −0 — [`c6c6c8e`](https://github.com/abgnydn/webgpu-q/commit/c6c6c8e625f01fe6de8f903202d6435e250333bf)
- `03:17` **feat(swarm): federated CCSD(T) — sliceable (T) + distributed kernel +…** — +228 −2 — [`1d7e8e0`](https://github.com/abgnydn/webgpu-q/commit/1d7e8e0f12494911089b1cdfcbc72310106e3ef2)
- `03:17` **docs(honesty): correct the IP-EOM record — clean, not patched** — +13 −5 — [`009cde5`](https://github.com/abgnydn/webgpu-q/commit/009cde56e10f23435583de5d6401c86d0b007367)
- `02:38` **feat(e2e): opt-in NVIDIA validation lane (WEBGPU_Q_NVIDIA) + hard non…** — +72 −19 — [`d99f3df`](https://github.com/abgnydn/webgpu-q/commit/d99f3df1e6b4ae9a15b282b75cb0ce77d14eedd9)
- `02:32` **docs(results): record first cross-vendor GPU validation — NVIDIA T4** — +64 −0 — [`bd83af7`](https://github.com/abgnydn/webgpu-q/commit/bd83af74a41661aae1e52e16f3cee88e9cdcb4f5)
- `02:11` **feat(colab): save + auto-download full L1/L3 artifacts, report worst-F** — +2 −2 — [`4537287`](https://github.com/abgnydn/webgpu-q/commit/4537287c8556c7b468201aeb6877ad25555bdfd1)
- `02:07` **feat(e2): add NVIDIA datacenter/Turing peak-BW entries; Colab probe u…** — +18 −1 — [`b9342ed`](https://github.com/abgnydn/webgpu-q/commit/b9342ed73b48eeb3a291c88e13eeb354436f66bd)
- `01:48` **feat(colab): report per-protocol status + failing rows instead of tru…** — +3 −3 — [`815ca5c`](https://github.com/abgnydn/webgpu-q/commit/815ca5ca07d0d6281bb101e586a2ed402395b9b1)
- `01:42` **fix(colab): install Chromium OS deps (--with-deps) + strip swiftshade…** — +2 −2 — [`b8f6306`](https://github.com/abgnydn/webgpu-q/commit/b8f6306c0e997e9627fb018d98f0a519421ed0ca)
- `01:32` **fix(colab): use async Playwright API — Colab runs an asyncio loop** — +1 −1 — [`43c4d08`](https://github.com/abgnydn/webgpu-q/commit/43c4d08aa3c00ccdad45b9898a387beeae5b15ea)
- `01:24` **docs(colab): add one-click Colab notebook for the real-GPU T4 probe** — +40 −0 — [`f757e88`](https://github.com/abgnydn/webgpu-q/commit/f757e88ea17753afdc74f9e8e07215e2c47b60c6)
- `01:18` **docs(ci): WebGPU CI/cloud-GPU provider survey + Modal T4 probe** — +408 −0 — [`8b90b83`](https://github.com/abgnydn/webgpu-q/commit/8b90b836b447c44f09d293e4e7b79bc564e2cc3f)
- `00:51` **test(ip-eom): add multi-electron LiH brute-force oracle** — +302 −0 — [`8e540a7`](https://github.com/abgnydn/webgpu-q/commit/8e540a74eaf3ad762241ed5aea6438e8d1d5c7c6)

## 2026-06-17

- `11:08` **chore(release): v0.12.0 — site redesign + corrected manuscripts → Zenodo** — +41 −8 — [`aad6fc7`](https://github.com/abgnydn/webgpu-q/commit/aad6fc7525488242b0665a7e0c5df019a1810b02)
- `11:03` **chore(docs): sync the fusion headline to ground truth — 4.18× → 4.22×…** — +11 −11 — [`e2eb7a9`](https://github.com/abgnydn/webgpu-q/commit/e2eb7a9e556a640f1a64563a7d05c5fd1442684d)
- `10:56` **fix(paper): restore the WebGPU-dispatch reference, now verified (Macz…** — +32 −4 — [`4ee9c6c`](https://github.com/abgnydn/webgpu-q/commit/4ee9c6cc582943a6e95b2b04e4c9835138484780)
- `10:48` **fix(paper): correct the fusion manuscript — drop unverifiable ref, fi…** — +37 −218 — [`cd108da`](https://github.com/abgnydn/webgpu-q/commit/cd108dad527ea857326e30b5f97623a33b450685)
- `10:41` **fix(paper): correct the chemistry manuscript — citations, numbers, on…** — +83 −451 — [`126e845`](https://github.com/abgnydn/webgpu-q/commit/126e8457af8290a2a54e7304f0b2897717cd38ae)
- `10:24` **perf(landing): throttle, pause, and mobile-static the wavefunction field** — +35 −13 — [`dcc324e`](https://github.com/abgnydn/webgpu-q/commit/dcc324e4c36b8c8240167ab9442d51d49d3ed202)
- `09:51` **docs(readme): rewrite for the new brand — shorter, current, consistent** — +128 −388 — [`3f5c76b`](https://github.com/abgnydn/webgpu-q/commit/3f5c76b592e9553190557a21e4414e15eca0dbed)
- `09:19` **docs(readme): embed the live demo gif at the top** — +6 −0 — [`fbab7c8`](https://github.com/abgnydn/webgpu-q/commit/fbab7c8c9cb08d447260ede0c3e6d0bb5118e546)
- `09:05` **chore(share): on-brand OG card + share kit** — +87 −0 — [`89b8fb2`](https://github.com/abgnydn/webgpu-q/commit/89b8fb22092b5f5c45a12a78d450d880325f7f7c)
- `08:35` **feat(pages): extend the landing's design language to every sub-page** — +352 −89 — [`285712f`](https://github.com/abgnydn/webgpu-q/commit/285712f83fb9f829bec271e0f98ac45af0fee88b)
- `08:12` **feat(landing): reimagine the landing as a living wavefunction** — +709 −300 — [`f31c8e8`](https://github.com/abgnydn/webgpu-q/commit/f31c8e8e569c51bb7556a3210d1cd23354c9b4bc)
- `05:23` **chore(readme): scrub stale/overclaim numbers from README text + capab…** — +35 −35 — [`ff747cf`](https://github.com/abgnydn/webgpu-q/commit/ff747cf8deafb8dcba1155789afec3d4f1591861)

## 2026-06-16

- `11:37` **chore(honesty): close Tier-2 audit items — narrow paper novelty, drop…** — +32 −206 — [`2556641`](https://github.com/abgnydn/webgpu-q/commit/255664176b88538c53c0cc545e57c961c89812c6)
- `11:27` **fix(ea-eom): replace empirical σ_2 patch with PySCF port — validated …** — +429 −120 — [`f90c519`](https://github.com/abgnydn/webgpu-q/commit/f90c519ccbb3fefe3268bc18d5d69d10af31ce85)
- `11:03` **fix(honesty): close audit overclaims — retire bare 39×, fix stale ver…** — +173 −53 — [`a26a9c6`](https://github.com/abgnydn/webgpu-q/commit/a26a9c62103ad1eb670d3c47c9f2a374b43ae366)
- `09:46` **feat(screening): live in-browser molecular screen page — v0.11.0** — +639 −7 — [`c99e6eb`](https://github.com/abgnydn/webgpu-q/commit/c99e6eb1bda0543f6ce61a3663149cba6432eb21)

## 2026-06-15

- `12:52` **feat(screening): scaled discovery — exhaustive aza-chain sweep across…** — +140 −0 — [`845e0ca`](https://github.com/abgnydn/webgpu-q/commit/845e0cafd6c2659123f039db589ada951e1f1b00)
- `12:18` **feat(screening): validation + discovery campaigns — first real screen…** — +181 −0 — [`1e9fa40`](https://github.com/abgnydn/webgpu-q/commit/1e9fa4069c47809fb31e3ab79c13714f644be0ec)
- `09:43` **docs(svg): refresh README diagrams for v0.10.0** — +13 −13 — [`8dfd987`](https://github.com/abgnydn/webgpu-q/commit/8dfd987ed5b7fa4ccfda2013b37397b0f9a22ba8)
- `08:58` **chore(release): v0.10.0 — distributed chemistry across the crowd + si…** — +92 −12 — [`02098d4`](https://github.com/abgnydn/webgpu-q/commit/02098d41e40fef86396f54dc89aed8056c1bb75b)
- `08:25` **fix(swarm): greedy-pull scheduler — balanced auto-distribution** — +164 −143 — [`ffe4df1`](https://github.com/abgnydn/webgpu-q/commit/ffe4df1b490ac8bbeaf8a61841fc78e5b0bf0f0f)
- `07:14` **feat(swarm): honest multi-tab scaling curve + fix screening measurement** — +133 −7 — [`0a3f5f0`](https://github.com/abgnydn/webgpu-q/commit/0a3f5f0b3a8050d139db5adca625f9d4a08d30f7)
- `07:01` **feat(swarm): distributed molecule screening — rank a library by HOMO–…** — +141 −1 — [`de1412b`](https://github.com/abgnydn/webgpu-q/commit/de1412b36a4185da9f59d8e8f18d51b240c25087)
- `06:51` **test(swarm): measure distributed-MP2 single-molecule speedup — honest…** — +174 −0 — [`92132d8`](https://github.com/abgnydn/webgpu-q/commit/92132d80b8259f1dc7c4601ab6da9c57b175b710)
- `06:22` **feat(swarm): distributed DF-MP2 — collaborative single-molecule corre…** — +356 −2 — [`b4c1fc4`](https://github.com/abgnydn/webgpu-q/commit/b4c1fc429b60ae7add3c99ccbfef562444c929f2)

## 2026-06-10

- `06:40` **feat(swarm): lever 3 — gzip-binary-f64 wire codec for RelayTransport …** — +334 −13 — [`cff4c6c`](https://github.com/abgnydn/webgpu-q/commit/cff4c6c195a971f8f7325363555559f897bbfe98)
- `04:43` **refactor(chem): make f64 WASM the recommended DF default, GPU hybrid …** — +52 −38 — [`1488b24`](https://github.com/abgnydn/webgpu-q/commit/1488b242efcd9f3a5683f1b8bead5035c940138b)
- `03:54` **fix(claims): address scientific-critic findings — separate validated …** — +89 −8 — [`6fa7b92`](https://github.com/abgnydn/webgpu-q/commit/6fa7b922b8e567a0be688dbcf3a22c8dbc227fcb)

## 2026-06-09

- `11:49` **feat(site): surface the swarm on the landing page — nav, card, hero t…** — +52 −5 — [`15dd280`](https://github.com/abgnydn/webgpu-q/commit/15dd280cd5fb10e4862a3533b07d566fed65a36f)
- `10:27` **Merge pull request #1 from abgnydn/cross-machine-gpu-batch** — +2064 −87 — [`d79299c`](https://github.com/abgnydn/webgpu-q/commit/d79299cf9b2544466d406fa26c51fa013099789b)
- `09:44` **feat(chem): runUMP2Auto — DF-UMP2 completes the {R,U}×{HF,DFT,MP2} ma…** — +189 −0 — [`08479da`](https://github.com/abgnydn/webgpu-q/commit/08479da033265dc9b1503ed7bad5db65eb5ebe0a)
- `09:31` **feat(chem): runMP2Auto — size-gated DF-MP2, correlation energy at any…** — +122 −1 — [`50ad6de`](https://github.com/abgnydn/webgpu-q/commit/50ad6de14c30438a6bc8ec0faabc7883f8cde26a)
- `09:19` **feat(swarm): generalize chem kernel to RHF/UHF/RKS/UKS — radical & DF…** — +139 −20 — [`c951944`](https://github.com/abgnydn/webgpu-q/commit/c951944b70ceff24522583d63ac406923eb3e43f)
