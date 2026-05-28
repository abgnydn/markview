# Quill

A local-first grammar and writing assistant for macOS. Native overlay that watches whatever text field you're in across every app, runs Harper rules + a fine-tuned Gemma 3 270M LLM on the text, and offers click-to-fix suggestions and full-sentence AI rewrites — 100% on-device, no network calls, no cloud account.

> **Status:** v0.3 — working dogfood build. Full feature set in native Cocoa apps (TextEdit, Notes, Mail, Messages). Fallback summary panel for browsers / Electron. See [roadmap](#roadmap) for v0.4.

```
┌────────────────────────────────────────────────────────────────────┐
│  any text field in any app — your editing surface                  │
│                                                                    │
│                ┌──────────────────────────────┐                    │
│   I has a a̲p̲p̲l̲e̲.    ←  inline wavy underline                       │
│                ┌─────────────────────────┐                         │
│                │ AGREEMENT  has          │  ←  hover popover       │
│                │ The form of the verb…   │                         │
│                │ [have]  ↻ Rewrite w/ AI │                         │
│                └─────────────────────────┘                         │
└────────────────────────────────────────────────────────────────────┘
                            ▲
                     macOS Accessibility API
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│  Quill.app  (Tauri 2 + Rust, ~260 MB drag-install)                 │
│                                                                    │
│  focus tracker  →  Harper (rules, <10 ms)                          │
│                 →  Gemma 3 270M LoRA on CoEdIT (LLM rewrites)      │
│  mouse arbiter  →  toggles click-through dynamically               │
│  overlay window →  SVG underlines + hover popover                  │
│  AXUI apply     →  writes corrections back into the source app     │
└────────────────────────────────────────────────────────────────────┘
```

## Why

Grammarly desktop is ~90 MB of bundled Chromium plus a cloud round-trip. Harper is a beautiful 6 MB Rust grammar engine, but its authors deliberately refuse generative AI. The wedge is *both*: Harper for instant rule-based catches, plus a small local LLM for the contextual stuff Harper can't reach. Quill ships all of it offline.

## Architecture

```
quill/
├── shell/                       Tauri 2 app — the binary you actually run
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── lib.rs           module wiring + Tauri setup
│   │   │   ├── wire.rs          types crossing the IPC boundary
│   │   │   ├── state.rs         CheckerState / RewriteState
│   │   │   ├── commands.rs      #[tauri::command] thunks
│   │   │   ├── inference.rs     llama-cpp-2 wrapper          (feature = "llm")
│   │   │   └── overlay/         macOS-only system overlay   (feature = "overlay")
│   │   │       ├── window.rs        click-through Tauri window
│   │   │       ├── focus_tracker.rs polls AXUI focused element + bounds + text
│   │   │       ├── mouse_arbiter.rs toggles click-through dynamically
│   │   │       └── apply.rs         writes corrections back via AXUI
│   │   ├── capabilities/
│   │   └── tauri.conf.json
│   └── src/                     vanilla HTML/JS/CSS (no build step)
│       ├── index.html / main.js / styles.css      main window
│       └── overlay.html / overlay.js / overlay.css overlay
└── train/                       Python — Gemma 3 270M LoRA on CoEdIT
    ├── modal_train.py           Modal L4, ~15 min / ~$0.30
    ├── modal_convert.py         CPU-only salvage path
    ├── scripts/
    │   ├── prep_coedit.py
    │   ├── train.py             local / Unsloth path
    │   ├── eval.py
    │   └── convert_local.py     merge LoRA + run llama.cpp converter on Mac
    └── colab.ipynb              deprecated — Colab T4 has no bf16
```

## Build & install

### Prereqs

- macOS 13+ (Apple Silicon only for the bundled GGUF)
- Rust 1.75+, `cargo`
- `cmake`, Xcode CLT (for `llama-cpp-2` build)
- A `.gguf` model file (see [training](#training-pipeline) or pre-built path below)

### Drag-install path (fastest)

```bash
cd shell/src-tauri
cargo tauri build --features llm,overlay
# .app lands at target/release/bundle/macos/Quill.app
```

Then either drag it to `~/Applications/` in Finder, or:

```bash
./scripts/install-dev.sh --build --tail
```

The script does the full kill → cp → ad-hoc codesign → launch dance and tails the runtime log. The ad-hoc codesign with the stable `io.quill.app` identifier is **required** — otherwise every rebuild invalidates the macOS Accessibility grant.

### First launch

1. Open `~/Applications/Quill.app`.
2. **Grant Accessibility permission** when macOS prompts. The focus tracker needs `kAXFocusedUIElementAttribute` access to know what text field you're in.
3. Click into any text field in any app. The overlay window draws underlines at any detected lints; hover for the popover.

## Personalization (v0.5)

Quill keeps a private edit journal at `~/Library/Application Support/Quill/journal.jsonl` — every accepted suggestion and AI rewrite, never sent anywhere. The main-window footer shows the count.

When you've accumulated enough edits (~50+), train a personal LoRA adapter:

```bash
cd ~/quill/train
# In Quill main window: click ⤓ Export — notes the /tmp/quill-training-*.jsonl path
HF_TOKEN=hf_xxx .venv/bin/modal run modal_train_personal.py \
    --journal /tmp/quill-training-2026-MM-DD-T....jsonl

# After ~15 min and ~$0.20:
cp ./checkpoints/personal-adapter.gguf \
    "$HOME/Library/Application Support/Quill/personal-adapter.gguf"
killall quill; open ~/Applications/Quill.app
```

Header now reads **"harper + llm + personal"** and the green **personal** pill appears in the footer. From this point your rewrites bias toward how *you* edit, not toward the average CoEdIT writer. The base CoEdIT model stays intact — your adapter is a delta on top, generated locally on Modal, never seen by anyone but you.

To re-train as you accumulate more edits: re-export, re-run the Modal script, re-copy. v0.6 will automate this in a background sidecar.

## Training pipeline

The bundled model is a LoRA fine-tune of `unsloth/gemma-3-270m-it` on [`grammarly/coedit`](https://huggingface.co/datasets/grammarly/coedit) — Grammarly's open editing corpus.

```bash
# 1. Train on Modal L4 (~15 min, ~$0.30; new accounts get $30 free credit)
cd train
pip install modal && modal token new
HF_TOKEN=hf_xxx modal run modal_train.py

# 2. Convert + quantize to q4_k_m GGUF (on your Mac, ~5 min)
modal volume get --force quill-artifacts gemma3-270m-coedit-lora \
    ./checkpoints/gemma3-270m-coedit-lora
HF_TOKEN=hf_xxx .venv/bin/python scripts/convert_local.py \
    --checkpoint ./checkpoints/gemma3-270m-coedit-lora/checkpoint-NNN \
    --out        ./checkpoints/quill-q4_k_m.gguf

# 3. Drop the .gguf into shell/src-tauri/resources/ and rebuild the app
cp ./checkpoints/quill-q4_k_m.gguf ../shell/src-tauri/resources/
```

Notes & gotchas (full debug history in [`brain notes`](#brain-writeups)):

- **Don't use free Colab T4** — Gemma 3 NaNs in fp16 so Unsloth falls back to fp32 → ETA jumps from "8 min" to 4.5 h, and free Colab kicks the session before it finishes.
- **Modal new-account spend cap is well under $30** — set the explicit cap in `modal.com/settings/billing` before kicking off, or one run will block the next.
- **llama.cpp's converter trips on Gemma 3 270M's `<image_soft_token>`** at id 262144 (one past the embedding table). Patch `~/.cache/llama.cpp/conversion/base.py`: `assert max(tokenizer.vocab.values()) <= vocab_size` (allows equality). The converter only iterates `0..vocab_size`, so the orphan token is silently skipped.
- **`tokenizer.model` must be copied alongside the merged HF weights** for the SentencePiece path; otherwise the converter falls into the BPE path and hits an unrecognized-pre-tokenizer error.

## Per-app compatibility

| App | Inline underlines | Hover popover | Click-to-fix | Strategy |
|---|:--:|:--:|:--:|---|
| TextEdit | ✅ | ✅ | ✅ | AXUI text-set |
| Notes | ✅ | ✅ | ✅ | AXUI text-set |
| Mail | ✅ | ✅ | ✅ | AXUI text-set |
| Messages | ✅ | ✅ | ✅ | AXUI text-set |
| Slack (native) | ✅ | ✅ | ✅ | AXUI text-set, with clipboard fallback |
| Safari address bar | ✅ | ✅ | ✅ | AXUI text-set |
| Safari/Chrome web inputs | ❌ | fallback panel | ✅ | **clipboard fallback** |
| VS Code / Cursor | ❌ | fallback panel | ✅ | **clipboard fallback** |
| Discord | ❌ | fallback panel | ✅ | **clipboard fallback** |
| Tauri WKWebView (Quill's own window) | ✅ | ✅ | ✅ | AXUI text-set |

How the tiered apply works:

1. **Move the selection** via `kAXSelectedTextRangeAttribute` (works in nearly every app — even browsers expose caret manipulation through AXUI).
2. **Try direct text replacement** via `kAXSelectedTextAttribute` (native Cocoa apps honor this — fastest path).
3. **Fallback: simulate ⌘V** via `CGEventPost` after pushing the suggestion to `NSPasteboard`, then restore the user's clipboard ~120 ms later. Works in Safari/Chrome/Electron because they accept paste like any other app.

The strategy used per apply lands in `/tmp/quill.log` as `[quill][apply] strategy=AxuiText|Clipboard …` so per-app behavior is observable.

Inline underlines still don't render in browsers/Electron (those don't expose `kAXBoundsForRangeParameterizedAttribute`), but the fallback summary panel beside the field lists every suggestion and click-to-fix now works everywhere.

## Tests

```bash
cd shell/src-tauri
cargo test --features overlay --lib
```

Five tests covering Harper integration, the AXUI bounds-plausibility filter (rejects the `x=-1, y=-17899, w=1711, h=19017` garbage we saw in the wild), and a Tauri `mock_app` round-trip that exercises the `focus-update` emit/listen pipeline end-to-end without launching a GUI — catches capability/permissions regressions before they reach the user.

## Roadmap

- **v0.4 — Per-app coverage matrix + clipboard write-back fallback.** Recover click-to-fix in Safari/Chrome/Electron by simulating ⌘C → mutate clipboard → ⌘V via `CGEventPost`. Push the compatibility table from 50% to ~95% of common apps.
- **v0.5 — Menubar mode.** Drop the dock icon; Quill becomes ambient.
- **v0.5 stretch — BitNet b1.58 distill** of the LoRA adapter to ~500M ternary params → <100 MB total bundle. The wedge is even cleaner if we can ship the whole app at under a Grammarly Electron install.

## Brain writeups

Empirical history lives in this repo author's [research-vault](https://github.com/anthropics/claude-code/issues), with three relevant ledger entries:

- `E38-quill-shell-bootstrap` — Tauri + harper-core scaffold, perf hoist
- `E39-quill-coedit-lora` — fine-tune + GGUF saga, 9 wrong turns documented
- `E40-quill-overlay-shipping` — AXUI overlay, capability and TCC fights

## License

Personal project. No license declared — ask before using.

## Acknowledgements

- [`harper-core`](https://github.com/Automattic/harper) by Automattic — the rule engine and 90% of the spelling/grammar coverage
- [`unsloth`](https://github.com/unslothai/unsloth) — the only practical path to fine-tuning Gemma 3 on a reasonable GPU
- [`llama.cpp`](https://github.com/ggerganov/llama.cpp) + [`llama-cpp-2`](https://github.com/utilityai/llama-cpp-rs) — GGUF inference
- [Grammarly's CoEdIT corpus](https://huggingface.co/datasets/grammarly/coedit) — the training data
- [Google's Gemma 3 270M](https://huggingface.co/google/gemma-3-270m-it) — the base model
