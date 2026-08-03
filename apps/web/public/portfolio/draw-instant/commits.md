# Commits — draw-instant

## 2026-08-03

- `13:42` **docs: record the engine-vs-ORT result and the T4 limitation** — +48 −0 — [`53d5ce0`](https://github.com/abgnydn/draw-instant/commit/53d5ce0b8ba38ae281bddc8804b24978ae0200da)
- `12:16` **chore(colab): run the engine-vs-ORT comparison in the notebook too** — +20 −7 — [`1565701`](https://github.com/abgnydn/draw-instant/commit/1565701a37e2206781fe6252970b92b5ea44e5d7)
- `12:15` **feat: headless engine-vs-ORT comparison, and the answer** — +89 −1 — [`84871d2`](https://github.com/abgnydn/draw-instant/commit/84871d2aaaa721ec0a1a26222b6a6999c4d5876f)
- `12:10` **fix(executor): two bugs the ORT comparison surfaced** — +46 −3 — [`e36cfd6`](https://github.com/abgnydn/draw-instant/commit/e36cfd6d8c07845e7d543fdabde56f0aed7215f6)
- `10:10` **feat: engine-vs-ORT comparison harness** — +99 −0 — [`4d638d7`](https://github.com/abgnydn/draw-instant/commit/4d638d76e84bedf7af4bf1fbf7fd27045b7a502b)
- `06:50` **feat: cache probe — measure the redundancy before building for it** — +334 −3 — [`e33bad8`](https://github.com/abgnydn/draw-instant/commit/e33bad88d6c64d3c9419f5f2ee6f46c68c9b3d78)
- `06:26` **docs(roadmap): retire the launch-overhead thesis it was built on** — +11 −7 — [`75a21cf`](https://github.com/abgnydn/draw-instant/commit/75a21cff5bf3f9dc86e615292dcf025f2cbdadac)
- `06:25` **docs: the discrete-GPU number, and what it says** — +80 −46 — [`7e19ad6`](https://github.com/abgnydn/draw-instant/commit/7e19ad6fd38dfc13781f509aa185cf4a9453c046)
- `06:18` **fix(bench-headless): isolate each bench in its own process** — +42 −11 — [`e073c34`](https://github.com/abgnydn/draw-instant/commit/e073c347c7813bd13146cccd7cd891552b011666)

## 2026-07-31

- `10:51` **perf(wgsl-ops): register-block Gemm, 3.1-6.2x** — +95 −20 — [`38c138e`](https://github.com/abgnydn/draw-instant/commit/38c138ed603a2877574679cc5df47a02cc2284c6)
- `10:42` **perf(wgsl-ops): register-block convMM too, 4-5x on production shapes** — +125 −28 — [`54913e3`](https://github.com/abgnydn/draw-instant/commit/54913e338166faf375d040562d9a23ec9732ffed)
- `10:13` **perf(wgsl-ops): register-block the matmul, 2.6-4.5x on production shapes** — +159 −12 — [`a8376eb`](https://github.com/abgnydn/draw-instant/commit/a8376eb04c1c05a21fb0bfaf1542d045f24e33be)
- `10:06` **fix(bench): interleave the two paths, share one batch size, warm to s…** — +108 −74 — [`6645d2f`](https://github.com/abgnydn/draw-instant/commit/6645d2f5770830382f37c9f29d4f8b947dbdb5aa)
- `07:20` **fix(bench): roll batch-slope timing across all nine; correct the results** — +182 −175 — [`d8bbdbc`](https://github.com/abgnydn/draw-instant/commit/d8bbdbc64e8d28da83907a39feba58b8af88a6e5)

## 2026-07-30

- `13:05` **fix(bench): measure the work, not the fence** — +123 −53 — [`9882ada`](https://github.com/abgnydn/draw-instant/commit/9882adac2c238bcd105e878ae1c567e97ee6a2c2)

## 2026-07-28

- `12:53` **fix(ui): rename morph toggle to say what it actually changes** — +16 −16 — [`8d8bedd`](https://github.com/abgnydn/draw-instant/commit/8d8bedd8da763f85d763f1cd463df79e7a5b82f5)
- `12:44` **fix(ui): overlay the canvas placeholder instead of letting it fight t…** — +4 −0 — [`469b968`](https://github.com/abgnydn/draw-instant/commit/469b96895b54cca6a9d2a69a5b32102c89a416ba)
- `12:37` **fix(ui): remove the dead guidance slider; resolution now regenerates** — +9 −9 — [`f535cd6`](https://github.com/abgnydn/draw-instant/commit/f535cd63981b053b8f9957c00fa6ecfa45f9672f)
- `08:54` **fix(camera): ORT fp16 feeds need a native Float16Array on modern Chrome** — +10 −2 — [`c8b7c94`](https://github.com/abgnydn/draw-instant/commit/c8b7c9416e7ad6e62a7c907362722022e51c1dea)
- `07:26` **chore: exclude .wrangler/ from deployed assets** — +1 −0 — [`e106480`](https://github.com/abgnydn/draw-instant/commit/e106480925cd7d625161c50e5f423161b497bf2b)
- `07:25` **chore: never commit .wrangler/ local cache** — +3 −6 — [`3373803`](https://github.com/abgnydn/draw-instant/commit/3373803e0d49830bbff6c863b67062587d5b3d18)
- `07:25` **feat(bench): in-repo PyTorch head-to-head; drop unverifiable hero claim** — +114 −13 — [`37934dd`](https://github.com/abgnydn/draw-instant/commit/37934dde1143843e9309cdbdf0cfa31da67428f2)
- `07:18` **fix(copy): correct every stale claim on the rendered page** — +23 −20 — [`45580ea`](https://github.com/abgnydn/draw-instant/commit/45580eadaae263a95d53155845211dca4e006004)
- `07:05` **chore: shorten HF short_description to fit the 60-char limit** — +1 −1 — [`395879f`](https://github.com/abgnydn/draw-instant/commit/395879f578842a96e790750f416fc1360881da25)
- `07:04` **chore: Hugging Face Space frontmatter (sdk: static)** — +11 −0 — [`0cabfb8`](https://github.com/abgnydn/draw-instant/commit/0cabfb84faac12f80acb88f4d403a2c76080efea)
- `07:00` **Merge pull request #1 from abgnydn/fix/audit-2026-07** — +2139 −224 — [`684342c`](https://github.com/abgnydn/draw-instant/commit/684342c9b52fcc9b3cbc6bd807a5635157d2e876)
- `06:35` **docs: reconcile merged docs with the audited code** — +152 −99 — [`f7790aa`](https://github.com/abgnydn/draw-instant/commit/f7790aa344774f788cc8926e7d1ec2715a851ad2)
- `06:21` **merge: headless GPU bench tooling from claude/admiring-feynman-nbo17d** — +370 −0 — [`c6944ad`](https://github.com/abgnydn/draw-instant/commit/c6944ad8c73cc69990e80c0216610cbd18fadbf9)
- `06:20` **merge: docs, CI, package.json, and Workers deploy from claude/laughin…** — +1150 −4 — [`29fb0ac`](https://github.com/abgnydn/draw-instant/commit/29fb0ac0f55b3ad6ceaa8e097c449ae88b588899)
- `06:10` **docs(fused): make every kernel comment match what the kernel does** — +57 −38 — [`f281e3a`](https://github.com/abgnydn/draw-instant/commit/f281e3a6588a98d60052fb496ab9e55500d1c043)
- `06:09` **fix(wgsl): batched MatMul, sign-aware pow, parser field decoding, fai…** — +265 −72 — [`b0d8c14`](https://github.com/abgnydn/draw-instant/commit/b0d8c146f4e3909c04f7d50e9759ed794ce9d2cb)
- `06:09` **fix(models): real caching, correct pad id, fp16 VAE-encoder feed** — +88 −22 — [`ead0123`](https://github.com/abgnydn/draw-instant/commit/ead012374507a4ee22506dcc4b4e2a75a908e330)
- `06:09` **fix(pipeline): mode exclusion, loop epoch, resilient boot, honest met…** — +59 −19 — [`9d28236`](https://github.com/abgnydn/draw-instant/commit/9d28236c361fcfa155e827836401ead6e251454f)
- `06:09` **fix(bench): unbias the fusion probe and verify what it claims** — +68 −67 — [`ddf5e36`](https://github.com/abgnydn/draw-instant/commit/ddf5e362fc257b8b65a3d76e8062d7d3d408f891)
- `06:09` **chore: remove broken unet.onnx symlink; add .gitignore + MIT LICENSE** — +28 −1 — [`8b2e132`](https://github.com/abgnydn/draw-instant/commit/8b2e1323d19ec3bd5233a93cb43d658a82bca312)

## 2026-06-25

- `03:47` **deploy: switch Cloudflare config from Pages to Workers (static assets)** — +88 −139 — [`2a8eabf`](https://github.com/abgnydn/draw-instant/commit/2a8eabfec8480f38340caf0891ad6349e13a0445)
- `03:11` **deploy: wire up Cloudflare Pages (draw-instant.pages.dev)** — +173 −3 — [`a2c05b7`](https://github.com/abgnydn/draw-instant/commit/a2c05b7f179aaaece10fcf437db250d6ff6ed730)
- `03:02` **docs: match webgpu-q repo standard — full doc set + CI** — +632 −197 — [`af2cdf9`](https://github.com/abgnydn/draw-instant/commit/af2cdf96509b6d8fef2370d40717dbdf8cb6bfb2)
- `02:55` **docs: add README, LICENSE, and project hygiene** — +620 −1 — [`5deadcf`](https://github.com/abgnydn/draw-instant/commit/5deadcf8197b3dd15a4b30d97d57fb5ef90f7239)

## 2026-06-23

- `08:26` **feat: add Modal runner for headless GPU benchmarks from a cloud session** — +136 −7 — [`f51e608`](https://github.com/abgnydn/draw-instant/commit/f51e60887eb0bb84a34318d6763b3a6845c90c39)
- `07:39` **feat: scaffold Colab MCP for cloud (web) sessions** — +122 −0 — [`1f21e16`](https://github.com/abgnydn/draw-instant/commit/1f21e16895e8c48e741b5df4e103d9429c7a70fc)
- `06:51` **feat: one-click Colab notebook for the GPU benchmarks** — +92 −0 — [`9294b7a`](https://github.com/abgnydn/draw-instant/commit/9294b7a83661aa3333a88a078388e0cf8f9b165c)
- `06:44` **fix(bench): correct Colab Vulkan recipe after verifying against curre…** — +41 −16 — [`00fed60`](https://github.com/abgnydn/draw-instant/commit/00fed60a63921505fc9ec45add44673ea265cbe3)
- `06:38` **feat: headless WebGPU bench runner for discrete-GPU numbers** — +151 −0 — [`3da2987`](https://github.com/abgnydn/draw-instant/commit/3da298723c2a3645e453f1442fd095843c2fd292)
- `06:27` **chore: remove dev-only artifacts (broken symlink, debug script)** — +4 −27 — [`bf87f12`](https://github.com/abgnydn/draw-instant/commit/bf87f12c124eb32394afb4cda43d9fbd738fbe6f)

## 2026-05-28

- `13:54` **feat: initial — fused U-Net pass for realtime browser SD (v1.2)** — +12054 −0 — [`87df7c5`](https://github.com/abgnydn/draw-instant/commit/87df7c5e9a6d136c20afc01cc239fe9d35955628)
