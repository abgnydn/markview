# Commits — draw-instant

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
