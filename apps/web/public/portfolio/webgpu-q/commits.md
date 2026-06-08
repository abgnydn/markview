# Commits — webgpu-q

## 2026-06-08

- `12:53` **feat(gpu): GPU DF-JK — per-iteration Fock contraction from the B-tens…** — +189 −0 — [`53e3c4b`](https://github.com/abgnydn/webgpu-q/commit/53e3c4b6d11a63615cf245635a244bb45a45f3f1)
- `12:48` **test(gpu): end-to-end DF build (buildDFAuto) wins ~1.25-1.3x in the d…** — +35 −0 — [`5dc76e0`](https://github.com/abgnydn/webgpu-q/commit/5dc76e0e885a0dbba31cf754d01d0840cca75a3d)
- `12:45` **perf(gpu): buildBFromV projects in WASM SIMD — GPU DF build now wins …** — +32 −15 — [`da81ea6`](https://github.com/abgnydn/webgpu-q/commit/da81ea6a15907483140c38d1748776cc89cb0d17)
- `12:38` **feat(gpu): buildDFAuto — auto-select the GPU integral path where it wins** — +105 −0 — [`f16c6cd`](https://github.com/abgnydn/webgpu-q/commit/f16c6cd76fce17da06b95648ee98d5234ef4805d)
- `12:05` **test(gpu): d-regime scaling — GPU integral win GROWS with size (1.35×…** — +41 −0 — [`1ecdfcc`](https://github.com/abgnydn/webgpu-q/commit/1ecdfcc1ba787be112c662d6b62b529ccb88095e)
- `12:00` **test(gpu): characterize the GPU integral win — it's angular-momentum-…** — +67 −0 — [`3207dbb`](https://github.com/abgnydn/webgpu-q/commit/3207dbb87898133a5b1414a08fa8b37728ab42b7)
- `11:55` **perf(gpu): box-only R zeroing — GPU integral build now BEATS WASM (1.…** — +12 −3 — [`281d1c8`](https://github.com/abgnydn/webgpu-q/commit/281d1c8fc7a66e2d190e3a33482ed4af040f7a9a)
- `11:37` **perf(gpu): 2-slab R-tensor in the 3-index kernel — 1.5× faster, corre…** — +19 −10 — [`2a4aba1`](https://github.com/abgnydn/webgpu-q/commit/2a4aba14831629ba6f86671548f6a27f1d9f2c08)
- `11:28` **feat(gpu): WebGPU integral build #4 — measure the win (correct, but n…** — +151 −0 — [`f771e22`](https://github.com/abgnydn/webgpu-q/commit/f771e2213c7eaf1080a9bc84f7259673519f4bb8)
- `11:19` **feat(gpu): WebGPU integral build #3b/#3c — full s/p/d 3-index, valida…** — +322 −41 — [`7d78b18`](https://github.com/abgnydn/webgpu-q/commit/7d78b1856f969ccf9c65825f8bdfe21f8dcb47f4)
- `11:04` **feat(gpu): WebGPU integral build #3 — s-only 3-index tensor, validate…** — +215 −0 — [`bb31240`](https://github.com/abgnydn/webgpu-q/commit/bb31240156d5951348cc4316e7d30bf1cf3fb76c)
- `10:32` **feat(gpu): WebGPU integral build #2 — s/p/d 2-index metric in f32, va…** — +212 −110 — [`f61032b`](https://github.com/abgnydn/webgpu-q/commit/f61032bc7acfcf92489836590d421602bb388b5b)
- `10:15` **feat(gpu): WebGPU integral build #1 — 2-index metric in f32, validate…** — +231 −0 — [`45f38f6`](https://github.com/abgnydn/webgpu-q/commit/45f38f61821ef4c398090253ce297fa46841fe06)
- `10:01` **test(df): f32 feasibility probe — step 0 of the WebGPU integral build** — +60 −0 — [`992e0e5`](https://github.com/abgnydn/webgpu-q/commit/992e0e54426b652b4da9181af39a51cfd3badd19)
- `09:39` **feat(swarm): N-machine distributed HF — N=2 and N=4 across separate VMs** — +117 −105 — [`1fdc487`](https://github.com/abgnydn/webgpu-q/commit/1fdc487b68ea16232b5f02918ce0e82a1c71cb68)
- `09:35` **docs(readme): cross-machine swarm now verified — N=2 distributed HF t…** — +1 −1 — [`217c251`](https://github.com/abgnydn/webgpu-q/commit/217c25184f05f8efdf7198e3e46692a05f2f4a5b)
- `09:31` **feat(swarm): N=2 cross-machine distributed HF over a free relay — the…** — +302 −1 — [`d900fc0`](https://github.com/abgnydn/webgpu-q/commit/d900fc064d662d81c6bd61acc10b42e9a2ceb542)
- `08:43` **feat(swarm): cross-machine proof via free public relay (WebRTC needs …** — +103 −2 — [`1450f59`](https://github.com/abgnydn/webgpu-q/commit/1450f5916e3962bb529d6dbb887414c3bd4f6515)
- `08:35` **feat(swarm): cross-machine WebRTC de-risk — 2 Actions VMs, free TURN** — +159 −2 — [`9b1a921`](https://github.com/abgnydn/webgpu-q/commit/9b1a9213e92595f2d4d6bfb50e26e0ed4135926a)
- `07:51` **chore(release): v0.9.4 — the streaming swarm crosses the 2 GB single-…** — +73 −16 — [`a6d1b6b`](https://github.com/abgnydn/webgpu-q/commit/a6d1b6bb08d94a14150fb7c3a75b566551f738c4)
- `07:38` **docs(paper): write up the streaming swarm crossing the 2 GB single-al…** — +109 −9 — [`d8111f4`](https://github.com/abgnydn/webgpu-q/commit/d8111f4642267be58eba77a6c2adc8058792281a)
- `07:24` **feat(swarm): commit the wall-crossing headline artifact — 40 H2 cc-pV…** — +45 −0 — [`5100f57`](https://github.com/abgnydn/webgpu-q/commit/5100f57ac036c715f28271c520d13968fc151bb4)
- `06:39` **ci(swarm): raise scaling-ladder test cap to 100 min for slow-runner v…** — +1 −1 — [`52ab041`](https://github.com/abgnydn/webgpu-q/commit/52ab041f74889a7bb2d466171a5f80a63e6a3475)

## 2026-06-05

- `07:37` **perf(swarm): WASM SIMD mode-projection — ~3.4× faster streaming build…** — +151 −34 — [`818495c`](https://github.com/abgnydn/webgpu-q/commit/818495ce75e993597ee9b5eb206cdbe016b69354)
- `06:38` **test(df): streaming-DF accuracy ladder vs exact HF — auto-aux L1 alre…** — +65 −0 — [`c83211f`](https://github.com/abgnydn/webgpu-q/commit/c83211fc8faa119eeb39c1ad9be1f27632188728)
- `06:24` **feat(swarm): emit env-stamped artifacts from the scaling ladder; CI u…** — +23 −2 — [`2e89a39`](https://github.com/abgnydn/webgpu-q/commit/2e89a39f857cb562ffa16aa58649377e253dba14)
- `05:23` **fix(swarm): build tab slices concurrently, not serially — the CI time…** — +9 −7 — [`021df92`](https://github.com/abgnydn/webgpu-q/commit/021df92e9ad7986bdc7072ee22ed16fd17c3ab46)
- `04:45` **ci(swarm): scaling-wall workflow — streaming swarm past the 2 GB Arra…** — +64 −0 — [`ab12a17`](https://github.com/abgnydn/webgpu-q/commit/ab12a1781c83860d7eaaa91141935a42e1901fcc)
- `04:44` **feat(swarm): N-tab streaming scaling ladder with a non-interacting en…** — +205 −1 — [`fda9aaf`](https://github.com/abgnydn/webgpu-q/commit/fda9aafc177349dfb03cce4ded7847385dbd4810)
- `04:30` **feat(swarm): streaming swarm HF e2e — each tab self-builds its slice,…** — +200 −0 — [`60c628d`](https://github.com/abgnydn/webgpu-q/commit/60c628d30df54952ac62d13f520e066dc224f24c)
- `04:21` **feat(swarm): partition:{tab,of} option — each tab self-tiles the mode…** — +44 −3 — [`a2d49d8`](https://github.com/abgnydn/webgpu-q/commit/a2d49d8efac3793fb4a68b4dc6b765e71cedc7cf)
- `04:18` **feat(swarm): cooperative streaming aux-DF build — integrals built onc…** — +186 −0 — [`b46091b`](https://github.com/abgnydn/webgpu-q/commit/b46091b236bc354da37b664153e27d7fb25a87df)
- `03:59` **test(swarm): full DF-HF SCF from independently-built mode-slices == s…** — +54 −1 — [`410cb35`](https://github.com/abgnydn/webgpu-q/commit/410cb35947e15932fed51827fe5b7a0251fe16d2)
- `03:57` **feat(swarm): streaming mode-partitioned aux-DF build — never material…** — +255 −1 — [`3e4ce3c`](https://github.com/abgnydn/webgpu-q/commit/3e4ce3c51f08e3662130eb4033d910a7b4e2453f)

## 2026-06-04

- `13:20` **fix(fusion-paper): correct the bandwidth claim — logical vs physical,…** — +80 −26 — [`c90b0cd`](https://github.com/abgnydn/webgpu-q/commit/c90b0cd3f94906caa6fe5d31a85881275f4e6aec)
- `11:19` **chore(release): v0.9.3 — deposit the corrected-DOI papers; concept DO…** — +27 −11 — [`6f02f07`](https://github.com/abgnydn/webgpu-q/commit/6f02f07d92e1ea0d081baf3a794f2cfffbf67f99)
- `11:07` **fix(zenodo): use the real concept DOI; wire in the v0.9.2 version DOI** — +26 −13 — [`98923a4`](https://github.com/abgnydn/webgpu-q/commit/98923a4cdba83cd886631d458691990481b46c6b)

## 2026-06-03

- `12:35` **chore(release): v0.9.2 — paper-hardening + artifact-backed swarm table** — +78 −9 — [`a7ef72d`](https://github.com/abgnydn/webgpu-q/commit/a7ef72d5e6fae74de66ead8dfa077c8bbcad994c)
- `06:14` **feat(swarm): commit C60 artifact — closes the last unverified table row** — +58 −8 — [`6971da7`](https://github.com/abgnydn/webgpu-q/commit/6971da7d8989548bca35dec0f274f66be219d6d6)

## 2026-06-02

- `09:05` **feat(swarm): emit committed artifacts for the scaling table; correct …** — +471 −105 — [`ecef9e8`](https://github.com/abgnydn/webgpu-q/commit/ecef9e86980f2a20dd50fb1a993e5457c1ed187e)
- `08:43` **docs(paper): lead correctness with what's validated, not test counts;…** — +65 −15 — [`2540b86`](https://github.com/abgnydn/webgpu-q/commit/2540b8614a087391d2a9486c3a599f527c202a05)
- `08:31` **docs(paper): correct claims that failed an against-the-repo audit** — +67 −50 — [`33406a9`](https://github.com/abgnydn/webgpu-q/commit/33406a93e89ee6d585e214b798e42215431efdfb)
- `07:28` **docs(paper): cite the two prior WebGPU single-kernel-fusion preprints** — +44 −3 — [`0f099ab`](https://github.com/abgnydn/webgpu-q/commit/0f099abe9c53930fd2003fdd426a5b368391d1c8)
- `07:15` **chore(release): prep v0.9.1 — reconcile version, refresh Zenodo metadata** — +10 −9 — [`6a3b99d`](https://github.com/abgnydn/webgpu-q/commit/6a3b99def1347d1b2aeed0135e0cede1cc2e07a1)
- `07:07` **docs(paper): add four data figures; fix fusion tier-ladder table over…** — +150 −5 — [`22548b1`](https://github.com/abgnydn/webgpu-q/commit/22548b16907c512134856e6a5cb5735884b786ea)
- `06:59` **docs(paper): LaTeX build of kernel-fusion manuscript w/ verified refs** — +285 −0 — [`4ef116b`](https://github.com/abgnydn/webgpu-q/commit/4ef116b01edd6961558d85350e3ff20178f572cd)
- `06:56` **docs(paper): LaTeX build of chemistry+swarm manuscript w/ verified refs** — +603 −13 — [`ca974da`](https://github.com/abgnydn/webgpu-q/commit/ca974da004502c252ba1fc1b1af0659e262fc030)
- `06:28` **docs(paper): v0.5 — third figure (swarm protocol), numbered refs, re-…** — +128 −23 — [`e89ffef`](https://github.com/abgnydn/webgpu-q/commit/e89ffef42ffb660a2e7b574abff4f5f0cc424cd2)
- `05:34` **docs(paper): render fusion manuscript to PDF (pandoc+xelatex, Menlo m…** — +0 −0 — [`8873ee4`](https://github.com/abgnydn/webgpu-q/commit/8873ee451a96e1cf1edb9ad8c7292a076a42c9c7)
- `05:27` **docs(paper): draft the kernel-fusion manuscript (Level 3) — companion…** — +205 −0 — [`9a93278`](https://github.com/abgnydn/webgpu-q/commit/9a932784e4ef979ac10eb803c1e6b9bc2093f8f5)
