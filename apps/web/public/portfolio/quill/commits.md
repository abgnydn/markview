# Commits — quill

## 2026-08-12

- `05:59` **Merge pull request #1 from abgnydn/claude/fix-and-improve** — +5924 −1279 — [`532ae22`](https://github.com/abgnydn/nib/commit/532ae22e69eb95e03c16d97d81f959d7d6ee68d4)

## 2026-08-10

- `06:10` **docs: re-baseline premium tier with the strict scorer (81.1% / 88.9% …** — +2137 −10 — [`7acf28a`](https://github.com/abgnydn/nib/commit/7acf28afa50254edd37f7c95dc7422971396bc62)
- `03:44` **docs/scripts/site: honest privacy copy, log out of /tmp, doc-reality …** — +82 −38 — [`5ad6e47`](https://github.com/abgnydn/nib/commit/5ad6e47dc95228fa25236e7ba2f054e657781742)
- `03:44` **train: fix eval-scorer inflation, Modal 1.x port, RSFT dedup + holdou…** — +565 −103 — [`bfd84b1`](https://github.com/abgnydn/nib/commit/bfd84b16db0bce71642eb60062892390fbe274b9)
- `03:44` **frontend: fix ReferenceError toasts, training-modal re-attach, stale-…** — +156 −53 — [`0569480`](https://github.com/abgnydn/nib/commit/05694806a4d880caca3d8f279ea48360c6a4f96d)
- `03:44` **shell config: set CSP, split overlay capability, fix stale Full-bundl…** — +44 −8 — [`46d9955`](https://github.com/abgnydn/nib/commit/46d9955360f7fca81f2f5819fec8c79d8786f57c)
- `03:42` **shell: fix download chain, UI-thread stalls, clipboard races, and dat…** — +1087 −524 — [`5f4e7dc`](https://github.com/abgnydn/nib/commit/5f4e7dc1d11bc772d0653654997bc659b44d295b)

## 2026-06-25

- `03:12` **site: point GitHub links at abgnydn/nib (rename is live)** — +6 −7 — [`511e52e`](https://github.com/abgnydn/nib/commit/511e52e409d121a6d3ed5d0c2941981ab00316d9)
- `03:11` **site: add nib.pages.dev landing page (static, no build step)** — +632 −0 — [`8c9dce0`](https://github.com/abgnydn/nib/commit/8c9dce071d510f661c1291dcece98fb46ae11c42)
- `02:58` **docs: point in-repo references at the renamed nib GitHub repo** — +25 −21 — [`a26ec51`](https://github.com/abgnydn/nib/commit/a26ec5145dd8102af1319f3e48c02cbd11c83c02)

## 2026-06-23

- `09:35` **docs: note CI in CLAUDE.md, drop obsolete ci/ staging README** — +8 −33 — [`e59bd40`](https://github.com/abgnydn/nib/commit/e59bd4050a0d64203784ab97da9f6a4187cc60dd)
- `08:30` **Update CI workflow by removing comments and stubbing resource** — +8 −29 — [`775b42d`](https://github.com/abgnydn/nib/commit/775b42d5ec47919bd555004270c5cc2cba6ce59e)
- `08:14` **Rename ci.yml to ci.yml** — +0 −0 — [`cdfe59f`](https://github.com/abgnydn/nib/commit/cdfe59fedacdab19464bb77a7d042bb825891f6f)
- `08:04` **Rename ci/ci.yml to github/workflows/ci.yml** — +0 −0 — [`f5e47a2`](https://github.com/abgnydn/nib/commit/f5e47a263acb1b3278add03c0ece27370c56d24b)
- `07:44` **ci: stage GitHub Actions workflow under ci/ (workflow path is push-bl…** — +120 −0 — [`879847c`](https://github.com/abgnydn/nib/commit/879847c83450789960ceb8ca34a3c9940e86ddee)
- `07:33` **eval: add Claude LLM-judge + Modal cloud eval (no Mac needed)** — +471 −42 — [`fac046f`](https://github.com/abgnydn/nib/commit/fac046f20b7ed401fcfb09ae3fc744d6b9f283d4)
- `06:50` **refactor: complete the quill -> nib internal rename** — +348 −318 — [`de43855`](https://github.com/abgnydn/nib/commit/de438558aac448cc23e83af0ac890a21fcc02f61)
- `06:33` **docs: sync README/CLAUDE/train to v2.x "Nib" reality; fix stop-marker** — +429 −287 — [`ff0a394`](https://github.com/abgnydn/nib/commit/ff0a3943f934d227d2addd57555ab0448b2c8e91)

## 2026-06-03

- `06:03` **v2.3 negative control: pure self-resampling plateaus (88.9% -> 87.8%)** — +1093 −69 — [`998fc95`](https://github.com/abgnydn/nib/commit/998fc951ee1bea9f1f5d803626ee0fb0b644a5a3)

## 2026-06-02

- `08:12` **colab: name adapter output by dataset stem to kill download collisions** — +10 −3 — [`12aa93c`](https://github.com/abgnydn/nib/commit/12aa93c52bb989b0b2093fc6f238860dd4bb1d06)

## 2026-06-01

- `17:17` **90-case held-out + no-filter ablation dataset** — +3964 −1 — [`4e5d72c`](https://github.com/abgnydn/nib/commit/4e5d72c7a423c3a497510451db593dc9a43484f9)
- `12:12` **v2.3 dataset: 780 samples — pure self-bootstrap, no new targeted seeds** — +1560 −0 — [`27c25c6`](https://github.com/abgnydn/nib/commit/27c25c6214652743113e2f90a9c3a38c83af0d0c)
- `12:02` **writeup: $0 self-improving RSFT loop on Qwen 2.5-1.5B** — +217 −0 — [`0686ebd`](https://github.com/abgnydn/nib/commit/0686ebd1b04a53f8609ff7beb6f18bd370036f81)
- `11:22` **v2.2 verified: 93.3% on 60-case held-out, +5pp over v2.1, strict domi…** — +1145 −0 — [`35805c4`](https://github.com/abgnydn/nib/commit/35805c4b13d93b4e31c3a385242712bbf1ac4843)

## 2026-05-29

- `08:00` **v2.2 dataset: 827 samples — self-bootstrap from v2.1 + targeted hard-…** — +1664 −0 — [`4a8ae78`](https://github.com/abgnydn/nib/commit/4a8ae7879caa9af362cf094007febe8cda65d225)
- `07:53` **held-out benchmark + harness v2 + bootstrap plumbing** — +3973 −4 — [`7bfea6d`](https://github.com/abgnydn/nib/commit/7bfea6d3e885f43b03a0d1caf1471b33d6662f18)
- `07:35` **v2.1 eval result: Qwen + 551-sample LoRA = 48/50 (96%)** — +521 −0 — [`7498407`](https://github.com/abgnydn/nib/commit/74984079641868844ba62617fcbd93431c424469)
- `06:42` **adapter-only architecture + 4× RSFT dataset + Colab one-click flow** — +1659 −71 — [`b93a91e`](https://github.com/abgnydn/nib/commit/b93a91ebe79347ebcf8784c32358eabb4a6bcbc6)

## 2026-05-28

- `16:00` **v2.0: ship faithful-rewrite LoRA on Qwen 2.5-1.5B (34% → 70%)** — +922 −18 — [`207c34c`](https://github.com/abgnydn/nib/commit/207c34cd2ea4dfcc96133492503b62f68a29c839)
- `13:28` **v2.0 step 2: rejection-sampling data-gen script** — +233 −0 — [`703e7ea`](https://github.com/abgnydn/nib/commit/703e7ea28d962775c2b2e2b36337d254325f491c)
- `13:24` **v1.4.1: ship the +16pp template fix to users** — +8 −3 — [`66f2c4a`](https://github.com/abgnydn/nib/commit/66f2c4ad789ca569c5ddaf6b4c228ff797a741af)
- `12:51` **v1.4.1: ChatML system+user split — 18% → 34% on eval, zero training** — +79 −15 — [`149bd76`](https://github.com/abgnydn/nib/commit/149bd7607a8f0fab9bc691cb81c869c3560ad7c0)
- `11:16` **v2.0 step 1: eval harness for faithful-rewrite training** — +365 −0 — [`5ba9f51`](https://github.com/abgnydn/nib/commit/5ba9f51224e18a605a78eb91be1c29868534d46b)

## 2026-05-27

- `11:19` **v1.4.0: refactor pass before training sprint** — +16 −266 — [`76b4cf5`](https://github.com/abgnydn/nib/commit/76b4cf5b608e311e7e490b45345e5c77b2f6917e)
- `09:16` **v1.3.4: popover stickiness + stricter rewrite instruction** — +39 −11 — [`0ac8873`](https://github.com/abgnydn/nib/commit/0ac88736c8a34c7bb0e420b19de34eb947103bbc)
- `09:02` **v1.3.3: stop main from collapsing — page scrolls instead** — +8 −7 — [`5c10cda`](https://github.com/abgnydn/nib/commit/5c10cda75728219731092e8f2888592333e50bf4)
- `08:35` **v1.3.2: tray icon + branding leak + training explainer + textarea min…** — +120 −9 — [`18cf8d2`](https://github.com/abgnydn/nib/commit/18cf8d29e2628cb0dc800c28b07cfd4d35d099d2)
- `08:16` **v1.3.1: Full installer variant — both models pre-bundled** — +127 −31 — [`f2907a1`](https://github.com/abgnydn/nib/commit/f2907a15be578860d0c8719edc835cded76f667e)
- `08:05` **v1.3.0: multi-model picker — LFM2.5-1.2B-Instruct as premium download** — +593 −10 — [`83c92a7`](https://github.com/abgnydn/nib/commit/83c92a7d94a193c40e85cafeebb7378dae7555f4)
- `07:38` **v1.2.1: instruction quality fixes for the rewrite panel** — +83 −4 — [`151cb07`](https://github.com/abgnydn/nib/commit/151cb077437a5c579cd6f1a4b941591f2e71d480)
- `07:24` **v1.2.0: color-coded categories + tone chips + pause presets** — +313 −16 — [`893a8c7`](https://github.com/abgnydn/nib/commit/893a8c77960ef9aa1c405a6520d46fd54be03c50)
- `07:13` **v1.1.2: 300ms hide + 18px trigger + popover is word-only** — +29 −38 — [`81015e8`](https://github.com/abgnydn/nib/commit/81015e817799e525386a7d802064f921616cd738)
- `07:06` **v1.1.1: selection-update fires on every tick** — +40 −30 — [`12a455c`](https://github.com/abgnydn/nib/commit/12a455ce03f3dab310c0046fe284606a4c928816)
- `07:00` **v1.1.0: Grammarly-style selection trigger + dedicated rewrite panel** — +418 −4 — [`3a9aafb`](https://github.com/abgnydn/nib/commit/3a9aafb638799bf4aa4ee9960953f9cbcd583387)
- `06:42` **v1.0.9: stale-underlines fix + context-aware hide + sentence-scoped r…** — +101 −32 — [`ec20752`](https://github.com/abgnydn/nib/commit/ec207528d0923f57c4f6fd37a4826c4af27a94f1)
- `06:37` **v1.0.8: clamp popover to screen.availHeight, not window.innerHeight** — +30 −14 — [`0e481c5`](https://github.com/abgnydn/nib/commit/0e481c5809e4641439c8864b67696171ba4c7c6e)
- `06:31` **v1.0.7: popover doesn't overflow + sticks 3s instead of 600ms** — +35 −18 — [`28b2212`](https://github.com/abgnydn/nib/commit/28b22129e72dce0c0866dd0cf4ddc1facb5df803)
- `06:25` **v1.0.6: ignore focus-steal events so buttons actually apply** — +21 −4 — [`7eafeff`](https://github.com/abgnydn/nib/commit/7eafefff9f8a99413e67a139414473eed926d272)
- `06:16` **v1.0.5: remove desktop chip + sweep remaining 'Quill' strings** — +27 −40 — [`1a12c13`](https://github.com/abgnydn/nib/commit/1a12c1392d36cffb3a2dc6441603e113c0674c35)
- `06:07` **chore(install): auto-cleanup old versions on every build** — +37 −0 — [`466be33`](https://github.com/abgnydn/nib/commit/466be3311f8e07e073c750e90a92d33c08fa7ef6)
