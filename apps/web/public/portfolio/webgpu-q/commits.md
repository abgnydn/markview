# Commits — webgpu-q

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

## 2026-06-01

- `16:47` **docs: wire in Zenodo DOI 10.5281/zenodo.20494383** — +6 −3 — [`8e2fbfe`](https://github.com/abgnydn/webgpu-q/commit/8e2fbfeaf4c2f486c79092a2133c514b7aeb67dc)
- `16:37` **docs: Zenodo deposit prep — rendered paper PDF, .zenodo.json, CITATIO…** — +45 −5 — [`bcbe063`](https://github.com/abgnydn/webgpu-q/commit/bcbe063c27e2de1471fe9ec62ed9c469a44ebb94)
- `16:26` **docs(paper): v0.4 — align language to published-paper conventions** — +37 −22 — [`2005c45`](https://github.com/abgnydn/webgpu-q/commit/2005c450d41617c0c1a8900dbd0896bc6c924d03)
- `16:20` **docs(paper): v0.3 — validation coverage, availability + reproducibility** — +57 −5 — [`a917070`](https://github.com/abgnydn/webgpu-q/commit/a917070f204188903ab943045187971715c27d18)
- `16:12` **docs(paper): memory-wall figure + fleshed swarm protocol (§2.4)** — +126 −7 — [`0b43e54`](https://github.com/abgnydn/webgpu-q/commit/0b43e541015118ee267c314a544399e8e44b5ee0)
- `12:24` **fix(ci): ignore post-success teardown RPC flake; revert forks/serial …** — +21 −17 — [`2a2990b`](https://github.com/abgnydn/webgpu-q/commit/2a2990bc581080c31cd2ac237c29a2d058732f5f)
- `12:16` **docs(paper): add scaling figure (acene series + C₆₀), wire into manus…** — +83 −0 — [`f9b9d5b`](https://github.com/abgnydn/webgpu-q/commit/f9b9d5b208460447058457534e25ba0b94238c3f)
- `12:13` **docs(paper): first manuscript draft — browser-native QC + tab swarm t…** — +239 −0 — [`d7171b9`](https://github.com/abgnydn/webgpu-q/commit/d7171b9fc082464e7222d096823d535b930b51b1)
- `12:10` **fix(ci): run vitest files serially — fixes onTaskUpdate ack starvation** — +18 −10 — [`97fbc16`](https://github.com/abgnydn/webgpu-q/commit/97fbc16ebf2ce6b893336b443da6bddef6e4d2ef)
- `11:31` **fix(swarm): assert architectural invariant, not RHF convergence, for** — +34 −11 — [`5264c8a`](https://github.com/abgnydn/webgpu-q/commit/5264c8a2a6c998797284e5c03c4e916b6da39a22)
- `11:28` **fix(ci): switch vitest to forks pool — kills the onTaskUpdate IPC flake** — +12 −7 — [`e84408e`](https://github.com/abgnydn/webgpu-q/commit/e84408e94d0b50177b6eeb530989a2712eb44572)

## 2026-05-29

- `11:00` **docs: add NOTICE file for Apache 2.0 §4(d) compliance** — +49 −0 — [`00e1a7c`](https://github.com/abgnydn/webgpu-q/commit/00e1a7c76630604b69871c95c898fb05ccd85760)
- `10:51` **docs: design for per-tab independent B-tensor build** — +194 −0 — [`9535a0c`](https://github.com/abgnydn/webgpu-q/commit/9535a0ce4505ead050c3d2d44ac877b1b684f217)
- `10:49` **feat(swarm): octacene C₃₄H₂₀ STO-3G — 8-ring acene, 190 basis** — +281 −1 — [`40188d7`](https://github.com/abgnydn/webgpu-q/commit/40188d7540748dbf8b354b54c54a3406ccddfbcb)
- `10:30` **feat(swarm): heptacene C₃₀H₁₈ STO-3G — 7-ring acene with delayed-DIIS** — +253 −1 — [`80fb9e4`](https://github.com/abgnydn/webgpu-q/commit/80fb9e49dc08922c5f5689b411a1a163a25c06b5)
- `10:26` **feat(swarm): hexacene C₂₆H₁₆ HF SCF — 6 fused rings, 146 basis** — +265 −1 — [`c2df6a9`](https://github.com/abgnydn/webgpu-q/commit/c2df6a9ae77975ddd8b2fb608ebd3e73c6ee58eb)
- `10:19` **docs(ci): document C₆₀ Ubuntu failure root cause in swarm-benches.yml** — +12 −0 — [`039bfa1`](https://github.com/abgnydn/webgpu-q/commit/039bfa1638ef01213bde30ec8ac139a6b89ac304)
- `10:16` **fix(swarm): relax anthracene cc-pVDZ energy bounds — converges to a** — +31 −9 — [`b01003b`](https://github.com/abgnydn/webgpu-q/commit/b01003b2e479af893f8e49e87b4a289aae219389)
- `10:14` **docs+ci: v0.9 changelog draft + vitest IPC timeout fix** — +94 −0 — [`af72b37`](https://github.com/abgnydn/webgpu-q/commit/af72b37982fc1d80117b25ebce2b7068cef7b496)
- `09:55` **fix(swarm): move test.use({ trace }) to top level — Playwright doesn'…** — +2 −1 — [`bce8266`](https://github.com/abgnydn/webgpu-q/commit/bce8266c413cc32e151cb3bea311c7803a787c01)
- `08:47` **test(swarm): anthracene cc-pVDZ with delayed-DIIS recipe** — +272 −9 — [`213f75d`](https://github.com/abgnydn/webgpu-q/commit/213f75d89f90746e18d4fc4bd0303e2fb563788e)
- `08:37` **fix(numbers): rebase two drifted claims to current empirical values** — +8 −2 — [`41f9ea3`](https://github.com/abgnydn/webgpu-q/commit/41f9ea31963b41dd31ab744829e46e7dce4bd3e7)
- `08:29` **feat(hf): diisStartIter option for delayed DIIS activation** — +45 −10 — [`b450896`](https://github.com/abgnydn/webgpu-q/commit/b450896dfe85235d0dfba0779797d81955ada6da)
