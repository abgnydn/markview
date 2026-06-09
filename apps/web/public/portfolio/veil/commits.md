# Commits — veil

## 2026-06-09

- `11:23` **feat(web): landing page, deployed to Cloudflare Pages** — +156 −0 — [`b6f98c0`](https://github.com/abgnydn/veil/commit/b6f98c0afcfc3dafcce93ec9b3549a1164fbd39f)
- `08:53` **feat(examples): live demo — a real Claude fixes the bug via `claude -…** — +96 −5 — [`b826f75`](https://github.com/abgnydn/veil/commit/b826f750038f42a1852e5ba7c585f62b59adbc22)
- `08:33` **feat(examples): coding-agent demo — file reads sanitized before the m…** — +1562 −2 — [`6a9c127`](https://github.com/abgnydn/veil/commit/6a9c1270840bb1730b736bb06607b3a6ff4d159f)
- `08:05` **feat: watch-the-wire demo + fix credential detection it exposed** — +387 −3 — [`d6426ef`](https://github.com/abgnydn/veil/commit/d6426efa69328181fa1d46d1be695a964261180b)
- `06:45` **feat(gliner): real accuracy benchmark on ai4privacy (corrects the han…** — +146 −26 — [`b72cdd8`](https://github.com/abgnydn/veil/commit/b72cdd8fef0f1d01c8ccec285822b2887d758bcf)
- `06:39` **feat(cohort): opt-in content-hiding via decoy corpus** — +313 −15 — [`a640d47`](https://github.com/abgnydn/veil/commit/a640d47bf6dd4cbab39963b8632f6886156252ee)
- `06:34` **chore(ts): remove legacy router.ts + cohort.ts stub** — +4 −519 — [`21d9f5e`](https://github.com/abgnydn/veil/commit/21d9f5e08ce3805dbe93854b0e9d89439966d424)

## 2026-06-08

- `13:45` **docs(readme): refresh to the real architecture (engine + shell + GLiN…** — +126 −97 — [`50220ca`](https://github.com/abgnydn/veil/commit/50220ca0dbf727641e34c0501d89ca110ca94e80)
- `13:04` **fix(clippy): sort_by → sort_by_key in merge_spans** — +1 −1 — [`49e4b34`](https://github.com/abgnydn/veil/commit/49e4b340ba1234a9a431510e9abddd44b9fc3340)
- `13:01` **ci: test the whole stack (was only typecheck+build, no tests ran)** — +102 −6 — [`4ab7821`](https://github.com/abgnydn/veil/commit/4ab7821aff05e0e4551be929a60f50bef06bebe1)
- `12:49` **feat(cohort): crypto-scramble pseudonym numbers — close pool-range fi…** — +190 −17 — [`9c4f80a`](https://github.com/abgnydn/veil/commit/9c4f80ab3d32933518c1002f156ad2ff79a4cafa)
- `12:42` **feat(cohort): wire k-anonymity fan-out end-to-end** — +365 −27 — [`4609848`](https://github.com/abgnydn/veil/commit/46098480b43dafd87f6ba8538e22acf7f0be0bef)
- `12:01` **feat(gliner): accuracy harness + threshold validation** — +178 −2 — [`8f57f6f`](https://github.com/abgnydn/veil/commit/8f57f6f246a87b505bc3470d46fa4c74e370d8b8)
- `11:55` **chore(phase1): validate real GLiNER model end-to-end** — +11 −4 — [`b22d912`](https://github.com/abgnydn/veil/commit/b22d912160bfa569523ecf7f1b7d8276bbffc8cb)
- `11:45` **feat(rust): wire learned detector into veil_server (VEIL_DETECTOR_URL)** — +130 −10 — [`657c2f5`](https://github.com/abgnydn/veil/commit/657c2f56d7a3def991a82a38d394b1e3da299270)
- `11:36` **docs: shared wire contract, detector protocol, v1 decisions, canonica…** — +570 −26 — [`0b09541`](https://github.com/abgnydn/veil/commit/0b0954183cfaa05192e8142d0fb4f3bed2f09ee0)
- `11:36` **feat(examples): MCP tier-enforcement server + GLiNER detector server** — +1903 −0 — [`b2a94c5`](https://github.com/abgnydn/veil/commit/b2a94c5c4cb8daf184c9724e660e3e87b34de8b1)
- `11:36` **feat(ts): RustPipelineClient + wrapWithVeil + VeilEnforcer** — +1056 −0 — [`33a90df`](https://github.com/abgnydn/veil/commit/33a90dff96480763632cf9dae3d16122a298764d)
- `11:36` **feat(rust): HTTP engine seam + generalize detector to HttpNerDetector** — +1001 −41 — [`878a477`](https://github.com/abgnydn/veil/commit/878a47711b0c44b9a1e3462747add58153be6e0a)
- `11:36` **chore(deps): drop unused jspdf dependency (2 transitive vulns → 0)** — +0 −232 — [`c6d46dc`](https://github.com/abgnydn/veil/commit/c6d46dced51c6c2fbe32ea181c6a618883edc752)

## 2026-05-19

- `13:21` **chore(deps): bump TypeScript 5.9 → 6.0 + tsconfig ignoreDeprecations** — +25 −10 — [`c9c8fb9`](https://github.com/abgnydn/veil/commit/c9c8fb9ba0cc0871044f818f1f1c2831cafd622b)
- `13:08` **chore(security): bump jspdf 2 → 4 to drop vulnerable dompurify chain …** — +55 −41 — [`87434f8`](https://github.com/abgnydn/veil/commit/87434f826fb0c4b6e4a4c4e12b688f42068ea970)

## 2026-05-18

- `16:19` **ci: add GitHub Actions workflow** — +36 −0 — [`fc98044`](https://github.com/abgnydn/veil/commit/fc98044a6f8f5802f8b85f68beeee1f0cf778d21)
- `07:40` **chore: remove KVKK compliance suite + regulated-mode router gate** — +15 −4195 — [`db18393`](https://github.com/abgnydn/veil/commit/db18393bb5f100555209a0b6e36983cce6c7d3f5)
- `07:22` **chore: wire build, license, runnable README** — +3591 −54 — [`4b17bb4`](https://github.com/abgnydn/veil/commit/4b17bb4b30bf6f3409f0f88d8629039a3f189abf)
- `06:42` **Initial commit** — +13095 −0 — [`39775cf`](https://github.com/abgnydn/veil/commit/39775cf96f388931dc21c9d41e0795c40ae01847)
