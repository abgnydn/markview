# Commits — zero-tvm

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

## 2026-05-15

- `03:40` **chore: update contact email to hi@barisgunaydin.com** — +1 −1 — [`9c2d099`](https://github.com/abgnydn/zero-tvm/commit/9c2d099bef976c25b763eab490704843e64247ac)

## 2026-05-14

- `13:50` **docs(readme): link RESEARCH_STANDARDS.md (shared canonical discipline…** — +1 −1 — [`05ef338`](https://github.com/abgnydn/zero-tvm/commit/05ef338e203041d8f4becf2cdba29883c6fa3a8f)
- `13:49` **docs: add canonical RESEARCH_STANDARDS.md (mirror of webgpu-q/RESEARC…** — +407 −0 — [`b4b0b4d`](https://github.com/abgnydn/zero-tvm/commit/b4b0b4ddbbfb63e6017eb49b99a8d35cbdc85aed)

## 2026-05-05

- `07:31` **feat(boot): unified weight-cache SW + download gate across chat templ…** — +958 −45 — [`9fe1cd2`](https://github.com/abgnydn/zero-tvm/commit/9fe1cd22c6c859d4b5ed764cf931060eb11725fc)
- `07:24` **feat(footer): add Star CTA + LinkedIn + personal-site links** — +35 −14 — [`211c92c`](https://github.com/abgnydn/zero-tvm/commit/211c92c123ec412d9db9034f06807bb80a938c2f)

## 2026-05-04

- `10:55` **Add CI, CHANGELOG, README badges** — +84 −0 — [`fd2ffff`](https://github.com/abgnydn/zero-tvm/commit/fd2ffffc7d044a38e7e3a0dd40682d1ad5bebfc9)

## 2026-04-22

- `07:04` **Link companion projects (kernelfusion, gpubench, webgpu-dna)** — +157 −0 — [`5ec0834`](https://github.com/abgnydn/zero-tvm/commit/5ec0834561bd203949691022f7059e8a1ce22ffd)
- `06:12` **Harden weight loader: persist, bounded concurrency, retry, version key** — +203 −47 — [`84cf90b`](https://github.com/abgnydn/zero-tvm/commit/84cf90bc6006abddb1a8d7df736cebf73f3004bb)
- `05:08` **Center start dialog and darken its backdrop** — +8 −4 — [`68645ac`](https://github.com/abgnydn/zero-tvm/commit/68645ac11addc4517dd531435d28cfe526e36fae)
- `04:34` **Polish /zero-tvm chat: markdown rendering, code blocks, regenerate** — +598 −112 — [`e9b918d`](https://github.com/abgnydn/zero-tvm/commit/e9b918d9be6cd0ae2b6ef43dd99bfaa6054c0e13)
- `04:07` **Revamp /zero-tvm chat UI — pre-download dialog + modern streaming layout** — +969 −85 — [`6f439bd`](https://github.com/abgnydn/zero-tvm/commit/6f439bd39615d6d0c268a6a773090bc3cab20c4f)

## 2026-04-21

- `14:15` **Rewrite /docs with honest post-fusion numbers** — +144 −122 — [`6219884`](https://github.com/abgnydn/zero-tvm/commit/62198849c6cbab7e8b693889f4fadaa7e712fc62)
- `14:08` **Update /demo with honest post-fusion numbers** — +43 −22 — [`f727e69`](https://github.com/abgnydn/zero-tvm/commit/f727e69b7f30b077c0670356859ff436f345a0be)
- `13:06` **Add shaders.html to production build and Tools grid** — +18 −3 — [`7780f6b`](https://github.com/abgnydn/zero-tvm/commit/7780f6bd09ae396ce99db5ff2172b47d65d4305a)
- `11:52` **Restore Share modal, dump.html, and back links to secondary pages** — +242 −4 — [`c3f1db7`](https://github.com/abgnydn/zero-tvm/commit/c3f1db75ab0ca754ab900ce08a891be186a22508)
- `11:39` **Move landing page to / — it was the landing all along** — +818 −1169 — [`37da17a`](https://github.com/abgnydn/zero-tvm/commit/37da17a513aa7d13735dffe5a295c3340da61075)
- `11:29` **OG/Twitter meta tags: honest social copy across all pages** — +71 −11 — [`f264f30`](https://github.com/abgnydn/zero-tvm/commit/f264f3047efb18cd8a4eef102fd6a75dfc8cd8da)
- `11:21` **Landing page: honest numbers, post-fusion shader grid, .vercelignore** — +71 −60 — [`8237f3e`](https://github.com/abgnydn/zero-tvm/commit/8237f3ed680a1a1b704c88229862faa7dc7a227e)
- `11:07` **Update README: shader count, dispatch counts, perf, honest head-to-head** — +134 −62 — [`2bc0d01`](https://github.com/abgnydn/zero-tvm/commit/2bc0d017bf80ec25628d4c071c871bd7656e6586)
- `10:47` **Post-merge fixups: restore our chat.ts + zero-tvm.html, union vite en…** — +48 −240 — [`b980d4c`](https://github.com/abgnydn/zero-tvm/commit/b980d4c955a7f61a681136855f265a0d88c1dc3f)
- `10:39` **Merge zero-tvm/main into master; take our side on conflicts** — +2402 −4046 — [`ea7d6be`](https://github.com/abgnydn/zero-tvm/commit/ea7d6be154f273608ceec6ed2ca567b5dac67326)
- `10:31` **Remove accidentally-committed public/town.html symlink** — +0 −1 — [`7d1cf28`](https://github.com/abgnydn/zero-tvm/commit/7d1cf2860e97dd6fc50c49f8daca7523ab629ab1)
- `10:30` **Docs + deploy: landing/architecture/docs pages, BENCH, Vercel config** — +3049 −0 — [`7e6aa92`](https://github.com/abgnydn/zero-tvm/commit/7e6aa92ebb676de0cc9038ff102825e4e17e3208)
- `10:30` **Head-to-head WebLLM bench + local-mirror dev middleware** — +398 −0 — [`4bdd17c`](https://github.com/abgnydn/zero-tvm/commit/4bdd17cc1dcf25232d5b43f92c1fead2ff212019)
- `10:29` **Zero-TVM decode: progressive weights, fused QKV, int8 KV, PLD sim** — +1122 −358 — [`fcefff3`](https://github.com/abgnydn/zero-tvm/commit/fcefff3a958630806a98802d88a1752411c47898)
- `10:29` **Add fused shader variants + subgroup kernels; wire into compiler** — +2345 −1 — [`f65ed50`](https://github.com/abgnydn/zero-tvm/commit/f65ed50a03dc423a9e934ccb7ec088ce053894cc)

## 2026-04-11

- `14:48` **Add Vercel Web Analytics script to user-facing pages** — +5 −0 — [`c00e1e1`](https://github.com/abgnydn/zero-tvm/commit/c00e1e195db547dfc1a0aec0f9f3e1db2a5ae567)

## 2026-04-10

- `14:09` **Fix mismatched units in landing-page bundle comparison** — +1 −1 — [`24d200a`](https://github.com/abgnydn/zero-tvm/commit/24d200ac74a0c5db3c47ae8842fe6395d28d11cd)
- `08:45` **Extract decode engine, add validate page, add e2e tests** — +1536 −432 — [`d5cfe86`](https://github.com/abgnydn/zero-tvm/commit/d5cfe86ae4ec9788545644ff128de060ead40c3c)

## 2026-04-08

- `14:40` **Remove placeholder benchmarks section from README** — +2 −7 — [`1aabf4b`](https://github.com/abgnydn/zero-tvm/commit/1aabf4bc1e423ef5089ff36f4ccec2003ee28aa7)
- `11:41` **Move input-wrap/input-inner to shared style.css, remove duplicate fro…** — +14 −31 — [`312a77d`](https://github.com/abgnydn/zero-tvm/commit/312a77df1762773a261a92869ea1c07f1d090344)
- `11:38` **Fix compiler-chat input alignment: use same input-wrap pattern as zer…** — +25 −28 — [`7a8cf64`](https://github.com/abgnydn/zero-tvm/commit/7a8cf64e5135f9b7551dbea7a321f81015ffe541)
- `11:33` **Add zerotvm.com link to README** — +3 −1 — [`10f3a6b`](https://github.com/abgnydn/zero-tvm/commit/10f3a6b8ab6088afefea2b24dc8de7f439b8c386)
- `11:29` **Replace image in README.md** — +1 −1 — [`2870fe9`](https://github.com/abgnydn/zero-tvm/commit/2870fe9e2d250ea5967180478d7ff6581e1aa4f9)
- `11:29` **Update OG meta tags to use zerotvm.com domain** — +11 −6 — [`6d95de3`](https://github.com/abgnydn/zero-tvm/commit/6d95de348d4edb4b3e34fbc948f05628ce980770)
