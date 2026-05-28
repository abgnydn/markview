# Commits — quill

## 2026-05-22

- `07:33` **v0.9 phase 2: local LoRA training via bundled llama-finetune-lora** — +444 −15 — [`7fbcaf1`](https://github.com/abgnydn/quill/commit/7fbcaf1d360603276402f8b65c500591048f6f1e)
- `07:23` **docs: refresh CLAUDE.md Resume block for v0.9 direction** — +35 −22 — [`9ccf3ce`](https://github.com/abgnydn/quill/commit/9ccf3cea259759ef21535535564529b783c95d65)
- `07:18` **v0.9 phase 1: bundle QVAC Fabric binaries inside Quill.app** — +159 −8 — [`8ddf0a3`](https://github.com/abgnydn/quill/commit/8ddf0a3a87c0912d89197eb01e23ab13dff17f89)

## 2026-05-21

- `12:44` **v0.7 (C+E): menubar mode + background auto-retrain** — +658 −5 — [`500ced3`](https://github.com/abgnydn/quill/commit/500ced33bc62ab1973ea4ad414ae599198d124ad)
- `12:25` **v0.6: add inline diff helpers (tokenizeWords/diffWords/renderDiffHtml)** — +41 −0 — [`4614049`](https://github.com/abgnydn/quill/commit/46140494e2858d44c04469206a91214713894dc0)
- `12:22` **v0.6: streaming rewrites + ⌘⇧R global hotkey + inline diff** — +527 −45 — [`d129372`](https://github.com/abgnydn/quill/commit/d1293723583ade2508f72fa96da5f0c40c036595)
- `09:31` **v0.5 phase 3: in-app training trigger via Modal subprocess** — +607 −0 — [`4a875de`](https://github.com/abgnydn/quill/commit/4a875de26f691ea6cee4d98765c33ef5ca5441f8)
- `08:04` **apply: clipboard fallback recovers click-to-fix in Safari/Chrome/Elec…** — +228 −33 — [`b8c82d9`](https://github.com/abgnydn/quill/commit/b8c82d9a61b573718743da766bacacee71e16413)
- `07:51` **tests: expand to 17 + 1 gated, plus scripts/test.sh full-suite runner** — +281 −0 — [`96a49ff`](https://github.com/abgnydn/quill/commit/96a49ffaeaf28121091f43198e776e980faf7532)
- `07:41` **v0.5 phase 2: personal LoRA pipeline end-to-end** — +419 −13 — [`239a918`](https://github.com/abgnydn/quill/commit/239a918ecbcd3d38031781d6591f83bf46b5e8e1)
- `07:15` **fix(v0.5): main-window sidebar applies were bypassing the journal** — +150 −3 — [`9b33bf0`](https://github.com/abgnydn/quill/commit/9b33bf0f7c9add727ac3caddb20b3741365ecc7b)
- `07:01` **v0.5 phase 1: personalization journal + main-window panel** — +611 −8 — [`4c7f6d4`](https://github.com/abgnydn/quill/commit/4c7f6d444592123da328611bd6778cb22d411fb1)

## 2026-05-20

- `16:53` **build: commit Cargo.lock for reproducible builds** — +8536 −1 — [`2b3e097`](https://github.com/abgnydn/quill/commit/2b3e097fc01092c4f47d005b1ecaa4c13710d39a)
- `16:52` **docs: top-level README with arch diagram + per-app compat matrix** — +179 −0 — [`25744bf`](https://github.com/abgnydn/quill/commit/25744bf844ba9ec104cbb6386651b0c679b998a7)
- `16:47` **refactor: split modules, polish overlay UX, add install script** — +1123 −660 — [`0369db0`](https://github.com/abgnydn/quill/commit/0369db0b48c7fbd1dc5d247e57672880991f8c2e)

## 2026-05-19

- `13:42` **overlay v0.2 — full grammarly-grade: inline underlines + apply + AI r…** — +677 −150 — [`b599063`](https://github.com/abgnydn/quill/commit/b599063e91c4375a68050b7c947fd2d161e447a1)
- `13:09` **overlay: capabilities + axui filter + e2e tests for the focus pipeline** — +571 −5 — [`cd308ce`](https://github.com/abgnydn/quill/commit/cd308cee1757fad213773ed6bffc508ee0fb753c)
- `07:10` **shell: bundle GGUF as tauri resource for drag-install .app** — +55 −21 — [`0bede06`](https://github.com/abgnydn/quill/commit/0bede06b10fa18e1ab82943f39264d1b01a7006a)

## 2026-05-18

- `19:16` **train: harden convert_local.py — idempotent + uv-aware + index override** — +44 −29 — [`f5e0fa5`](https://github.com/abgnydn/quill/commit/f5e0fa5873eb86131579406d2332061aa01aaa70)
- `17:31` **train: scripts/convert_local.py — mac-side fallback when modal is blo…** — +160 −0 — [`c720b8d`](https://github.com/abgnydn/quill/commit/c720b8d6c5aa1ea5adc5aafd7d4372c91324dd70)
- `17:27` **train: modal_convert.py — salvage path for interrupted runs** — +190 −0 — [`f055fd3`](https://github.com/abgnydn/quill/commit/f055fd31199ffa07354f674e93c81f426adea630)
- `16:01` **train: re-enable unsloth fast lora + halve seq len** — +10 −6 — [`dfca676`](https://github.com/abgnydn/quill/commit/dfca6760539176712e991f5e273178b780905723)
- `15:42` **train: relax modal image deps — trust unsloth's resolver** — +10 −13 — [`b54453e`](https://github.com/abgnydn/quill/commit/b54453ee45f2adbaecda8418e1003b8459a728d7)
- `14:50` **train: modal L4 script — replaces the colab trap** — +265 −5 — [`0123bca`](https://github.com/abgnydn/quill/commit/0123bca2087df9e2bb18319795f0437fb2b0a007)

## 2026-05-15

- `07:38` **shell: inference scaffold (llama-cpp-2 behind 'llm' feature)** — +505 −14 — [`5a2c24a`](https://github.com/abgnydn/quill/commit/5a2c24ab6504ba4f48ca967532119f18efba97df)
- `07:07` **train: add self-contained colab.ipynb for the vs code colab extension** — +316 −1 — [`8b782c3`](https://github.com/abgnydn/quill/commit/8b782c34592de6ef4128e98a34bcc5b9a582c8b6)
- `06:59` **train: migrate to unsloth — 30x faster, free colab t4 path** — +813 −237 — [`61124a7`](https://github.com/abgnydn/quill/commit/61124a7903ae17e577d54e1e093129115205d1c0)
- `04:36` **train: align train.py with trl 1.4 + transformers 5.8 api** — +10 −6 — [`d11e8d4`](https://github.com/abgnydn/quill/commit/d11e8d43be286a13ee2800a210db0f43b8eb2f4c)
- `04:33` **perf: hoist harper LintGroup into tauri managed state** — +2389 −28 — [`234da5d`](https://github.com/abgnydn/quill/commit/234da5de80c91980b102b9e8c5001c1dcd7437f0)
- `04:18` **initial scaffold: tauri + harper shell, gemma 270m train rig** — +5452 −0 — [`bd8c941`](https://github.com/abgnydn/quill/commit/bd8c941312d67305c07d847e6302b471299655ed)
