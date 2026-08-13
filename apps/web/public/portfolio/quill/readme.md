# Nib

A local-first grammar and writing assistant for macOS. A native overlay that
watches whatever text field you're in across every app, runs Harper rules + a
small fine-tuned local LLM over the text, and offers click-to-fix suggestions
and full-sentence AI rewrites — 100% on-device, no network calls, no account.

> **Status:** v2.3. Two-tier local model: **LFM2.5-350M** bundled by default,
> **Qwen 2.5-1.5B + the Nib-Faithful RSFT LoRA** as a premium tier. Full
> feature set in native Cocoa apps (TextEdit, Notes, Mail, Messages); clipboard
> fallback for browsers / Electron. See the [roadmap](#roadmap).
>
> **Naming:** the product, Cargo crate (`nib` / `nib_lib`), binaries (`nib`,
> `nib-rewrite`), logs, `NIB_*` env vars, the
> `~/Library/Application Support/Nib/` data dir, and the GitHub repo
> (`abgnydn/nib`) are all **Nib**. The author's original local clone still lives
> at `~/quill` (a fresh `git clone` now lands in `nib/`). Existing `…/Quill/`
> data dirs are migrated to `…/Nib/` on first launch.

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
│  Nib.app  (Tauri 2 + Rust, menubar-only / LSUIElement)             │
│                                                                    │
│  focus tracker  →  Harper (rules, <10 ms)                          │
│                 →  local LLM via llama-cpp-2 (base GGUF + LoRA)     │
│  mouse arbiter  →  toggles click-through dynamically               │
│  overlay window →  SVG underlines + hover popover                  │
│  AXUI apply     →  writes corrections back into the source app     │
└────────────────────────────────────────────────────────────────────┘
```

## Why

Grammarly desktop is ~90 MB of bundled Chromium plus a cloud round-trip.
Harper is a beautiful Rust grammar engine, but its authors deliberately refuse
generative AI. The wedge is *both*: Harper for instant rule-based catches, plus
a small local LLM for the contextual stuff Harper can't reach. Nib ships all of
it offline.

## Models

Nib runs GGUF models through `llama-cpp-2` (llama.cpp). The model picker in
Settings shows what's installed:

| Tier | Model | Notes | Size |
|---|---|---|---|
| **Default** | LFM2.5-350M-Instruct | bundled in the `.app`; fast, best for grammar fixes | ~219 MB |
| **Premium** | Qwen 2.5-1.5B + **Nib-Faithful LoRA** | preserves facts/numbers/technical tokens; **81.1%** strict / **88.9%** legacy on the 90-case held-out eval (v2.2 adapter) vs **64.4%** for stock Qwen | base ~940 MB (download once) + adapter ~36 MB |

The premium tier is an adapter applied at runtime on top of the shared Qwen
base — every future iteration ships as a tiny adapter swap. How that adapter is
trained (a $0 rejection-sampling self-play loop) is documented in
[`train/RSFT_BOOTSTRAP.md`](train/RSFT_BOOTSTRAP.md).

*Scoring note:* the eval harness now word-boundary-matches must-keep terms by
default (**81.1%**); the older unanchored-substring matching (**88.9%**,
`--legacy-keep-match`) is what every number in `train/reports/` was produced
with. Most of the gap is abbreviation-expansion cases (`72h`→`72 hours`) where
the numeric value is preserved but the notation changes.

> **Release:** the adapter the in-app download fetches
> (`nib-faithful-f16.gguf`, sha256 `aee9fe37…232b`) is a faithful
> reproduction of the v2.2 adapter — 88.9% legacy / 81.1% strict on the
> held-out benchmark, trained from `train/data/rsft-round3.jsonl` via
> `train/colab/train_nib_v2.ipynb`. It ships as the
> [`v2.1.0`](https://github.com/abgnydn/nib/releases/tag/v2.1.0) GitHub
> release (`gh release create v2.1.0 nib-faithful-f16.gguf`).

## Architecture

```
nib/                            # repo dir (product = "Nib")
├── shell/                      Tauri 2 app — the binary you actually run
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── lib.rs           module wiring, tray, global hotkey, Tauri setup
│   │   │   ├── wire.rs          types crossing the IPC boundary + Harper run
│   │   │   ├── state.rs         CheckerState / RewriteState + model-path resolve
│   │   │   ├── commands.rs      #[tauri::command] thunks
│   │   │   ├── models.rs        model registry + curl download orchestration
│   │   │   ├── inference.rs     llama-cpp-2 wrapper, base + LoRA   (feature = "llm")
│   │   │   ├── journal.rs       private edit journal (personalization)
│   │   │   ├── config.rs        ~/…/Nib/config.json
│   │   │   ├── training*.rs     Modal + local-QVAC personal training + scheduler
│   │   │   ├── qvac.rs          locator for bundled QVAC Fabric binaries
│   │   │   └── overlay/         macOS-only system overlay        (feature = "overlay")
│   │   │       ├── window.rs        click-through Tauri window
│   │   │       ├── focus_tracker.rs polls AXUI focused element + bounds + text
│   │   │       ├── engagement_policy.rs which apps/fields to engage
│   │   │       ├── mouse_arbiter.rs toggles click-through dynamically
│   │   │       ├── engaged_elem.rs  caches the AXUI element across focus-steal
│   │   │       └── apply.rs / clipboard.rs  AXUI text-set → ⌘V fallback
│   │   ├── resources/          bundled GGUF + qvac/ binaries
│   │   └── tauri.conf.json
│   └── src/                     vanilla HTML/JS/CSS (no build step)
│       ├── index.html / main.js / styles.css      main / settings window
│       └── overlay.html / overlay.js / overlay.css overlay
└── train/                       the model pipeline — see train/README.md
```

## Build & install

### Prereqs

- macOS 13+ (Apple Silicon for the bundled GGUF)
- Rust 1.75+, `cargo`, Tauri CLI 2.x
- `cmake`, Xcode CLT (for the `llama-cpp-2` build)

### Features

The default Cargo features are **empty** — a bare `cargo build` produces a
Harper-only shell with no LLM and no overlay. The real app needs both:

```bash
cd shell/src-tauri
cargo tauri build --features llm,overlay
# .app lands at target/release/bundle/macos/Nib.app
```

Then either drag it to `~/Applications/` in Finder, or:

```bash
./scripts/install-dev.sh --build --tail
```

The script does the full kill → cp → ad-hoc codesign → launch dance and tails
the runtime log. The ad-hoc codesign with the stable `app.nib` identifier is
**required** — otherwise every rebuild invalidates the macOS Accessibility grant.

### First launch

1. Open `~/Applications/Nib.app`. Nib is menubar-only (no dock icon); the tray
   icon is the persistent surface.
2. **Grant Accessibility permission** when macOS prompts. The focus tracker
   needs `kAXFocusedUIElementAttribute` access to know what text field you're in.
3. Click into any text field in any app. The overlay draws underlines at any
   detected lints; hover for the popover. Select text and hit the ↓ trigger (or
   `⌘⇧R`) for an AI rewrite.

## Personalization

Nib keeps a private edit journal at
`~/Library/Application Support/Nib/journal.jsonl` — every accepted suggestion
and AI rewrite, never sent anywhere. The main-window footer shows the count.

When you've accumulated enough edits (~50+), Nib can train a **personal LoRA
adapter** on top of the base model. Two backends, picked automatically:

- **Local (preferred, free, on-device):** when the QVAC Fabric binaries are
  bundled, Nib shells out to `llama-finetune-lora` on Metal (~5 min, $0). This
  is base-model-agnostic — it trains on whatever model you're running.
- **Modal (fallback, strictly opt-in):** spawns a cloud job (needs `HF_TOKEN`
  **and** `allow_cloud_training: true` in
  `~/Library/Application Support/Nib/config.json` — it uploads your edit
  journal to a cloud GPU, so it is never used implicitly). *Note: the current
  Modal personal script is a legacy Gemma path and is being rebased onto the
  v2.x models — prefer the local path.*

Auto-retrain can run in the background once a configurable number of new edits
accumulate (Settings → personalization). After training, the new adapter loads
on next relaunch; the footer shows a green **personal** pill when it's active.
Your edits never leave the machine on the local path.

## Per-app compatibility

| App | Inline underlines | Hover popover | Click-to-fix | Strategy |
|---|:--:|:--:|:--:|---|
| TextEdit / Notes / Mail / Messages | ✅ | ✅ | ✅ | AXUI text-set |
| Slack (native) | ✅ | ✅ | ✅ | AXUI text-set, clipboard fallback |
| Safari address bar | ✅ | ✅ | ✅ | AXUI text-set |
| Safari/Chrome web inputs | ❌ | fallback panel | ✅ | **clipboard fallback** |
| VS Code / Cursor / Discord | ❌ | fallback panel | ✅ | **clipboard fallback** |
| Nib's own window (WKWebView) | ✅ | ✅ | ✅ | AXUI text-set |

How the tiered apply works:

1. **Move the selection** via `kAXSelectedTextRangeAttribute` (works in nearly
   every app — even browsers expose caret manipulation through AXUI).
2. **Try direct text replacement** via `kAXSelectedTextAttribute` (native Cocoa
   apps honor this — fastest path).
3. **Fallback: simulate ⌘V** via `CGEventPost` after pushing the suggestion to
   `NSPasteboard`, then restore the user's clipboard ~120 ms later. Works in
   Safari/Chrome/Electron because they accept paste like any other app.

The strategy used per apply lands in the runtime log as
`[nib][apply] strategy=AxuiText|Clipboard …` so per-app behavior is observable.
Inline underlines still don't render in browsers/Electron (those don't expose
`kAXBoundsForRangeParameterizedAttribute`), but the fallback summary panel
beside the field lists every suggestion and click-to-fix works everywhere.

## Tests

```bash
./scripts/test.sh            # Rust lib tests + Python AST-parse + JS --check
```

Rust: ~67 tests (+2 ignored) with `--features llm,overlay` on macOS — covering
Harper integration and the curated/extra rule set, the IPC wire-format contract,
the AXUI bounds-plausibility filter (rejects garbage like
`x=-1, y=-17899, w=1711, h=19017`), the engagement policy (terminals/IDEs/URL
bars denied), the personal-adapter load path, training decision logic, ChatML
conversion, and a Tauri `mock_app` `focus-update` round-trip that exercises the
emit/listen pipeline without launching a GUI. The two ignored tests do a full
model+adapter load and run only when `NIB_TEST_MODEL` points at a `.gguf`.

## Roadmap

- **BitNet inference path.** A `RewriteEngine::Qvac` variant shelling out to the
  bundled `llama-cli` for ternary (b1.58) GGUFs, to push the bundle toward the
  sub-Grammarly footprint the wedge wants.
- **Adapter hot-reload.** Swap the engine in place after a successful retrain
  instead of the "relaunch to apply" badge.
- **Rebase the Modal personal-training path** onto the v2.x LFM2.5/Qwen bases
  (the local QVAC path already works).
- **Per-app coverage matrix** — push the compatibility table from ~50% to ~95%
  of common apps.
- **Multi-display overlay.** The overlay is one fixed window on the primary
  display today; secondary displays get suggestions only via the fallback
  panel. Needs a window per display.

## License

Personal project. No license declared — ask before using.

## Acknowledgements

- [`harper-core`](https://github.com/Automattic/harper) by Automattic — the rule
  engine and most of the spelling/grammar coverage
- [LiquidAI LFM2.5](https://huggingface.co/LiquidAI) — the bundled default model
- [Qwen 2.5](https://huggingface.co/Qwen) — the premium-tier base
- [`llama.cpp`](https://github.com/ggerganov/llama.cpp) +
  [`llama-cpp-2`](https://github.com/utilityai/llama-cpp-rs) — GGUF inference + LoRA
- [Grammarly's CoEdIT corpus](https://huggingface.co/datasets/grammarly/coedit) —
  the editing-data lineage the eval seeds descend from
- [Unsloth](https://github.com/unslothai/unsloth) — the LoRA fine-tuning path
