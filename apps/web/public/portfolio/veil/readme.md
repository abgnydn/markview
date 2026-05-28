# veil

> A privacy layer between your app and any third-party LLM. The model sees `EMAIL_1`; the user sees `alice@acme.com` back.

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)

```
                ┌───────────────┐
   alice@acme   │     veil      │   EMAIL_1
   /Users/...   │   ─── ▶ ───   │   PATH_1
   192.168.x.y  │   ◀ ─── ◀ ─   │   IP_1
                └───────────────┘
                  pseudonymize
                  forward
                  reverse-map
```

## Why

LLM prompts leak PII by default. Once an email or document path goes upstream, it's logged, cached, possibly trained on. veil sits between your app and the provider, swaps real identifiers for stable pseudonyms (`EMAIL_1`, `PATH_1`, `URL_1`, `IP_1`) before the wire, asks the model, and rewrites the answer back — including streamed tokens.

Round-trip stability is load-bearing: send "remind alice@acme.com" → model sees "remind EMAIL_1" → model says "Reminded EMAIL_1." → user sees "Reminded alice@acme.com." Across many turns of the same conversation the mapping stays consistent, so the model can reason about "the user mentioned earlier" without ever learning a real name.

## What's in the box

| | path | language | what it ships |
|---|---|---|---|
| **rust crate** | `rust/` | Rust 1.75+ | Regex pseudonymizer, `ProviderClient::Veil` wrapping variant, streamed `MessageStream` reverse-mapping. 3 commits across Phase 0 / 0.5a / 0.5b. |
| **typescript adapters** | `ts/` | TS 5 + Bun | Backend interface + tier algebra, caution-biased classifier, k-anonymous cohort blender, adapters for Anthropic + OpenAI-compat (Ollama, LM Studio, llamafile, vLLM), WebLLM, transformers.js. |

The two halves do not talk to each other yet. See "Status" below.

## Tier algebra

veil classifies content into four tiers and enforces them at adapter construction:

| tier | what it is | example |
|---|---|---|
| `public` | safe for any provider | "what's the capital of France" |
| `caution` | mildly identifying | "my project uses React 18" |
| `private` | clearly identifying | "alice@acme.com told me yesterday that…" |
| `secret` | regulated / confidential | passport number, medical record, banking credentials |

Each adapter declares its highest allowed tier in its constructor. The `AnthropicAdapter` hard-blocks `secret` and raw `private` content at construction — a mis-configured deploy fails fast instead of silently leaking. Cohort blending lets `private` content go through with k-anonymous neighbors mixed in.

## Quick start — Rust

```bash
git clone https://github.com/abgnydn/veil.git
cd veil/rust
cargo build --release
cargo test
```

```rust
use veil::{Veil, ProviderClient};

let veil = Veil::new();
let client = ProviderClient::Veil(Box::new(real_anthropic_client), veil);

// Real names go in; pseudonyms go to the wire; real names come back.
let stream = client.send_message_stream("Remind alice@acme.com about the demo").await?;
```

## Quick start — TypeScript

```bash
git clone https://github.com/abgnydn/veil.git
cd veil
npm install
npm run build      # builds both ts/ (tsup) and rust/ (cargo --release)
```

```ts
import { AnthropicAdapter, Veil, classify } from '@abgnydn/veil';

const veil = new Veil({
  adapter: new AnthropicAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
  highestAllowed: 'caution', // refuse to forward private / secret
});

const tier = classify(userText);          // → 'public' | 'caution' | 'private' | 'secret'
const reply = await veil.complete(userText);
```

## Dev

```bash
# Both halves
npm install
npm run build       # ts (tsup) + rust (cargo --release)
npm test            # ts (bun test) + rust (cargo test)
npm run typecheck

# Just the TypeScript adapters
cd ts && npm install && npm run build

# Just the Rust crate
cd rust && cargo build --release && cargo test
```

## Layout

```
veil/
├── rust/
│   ├── src/                Phase 0 regex pseudonymizer + Phase 0.5 ProviderClient + streaming
│   ├── examples/, tests/, Cargo.toml
├── ts/
│   ├── interface.ts        VeilBackend + tier algebra + error classes
│   ├── classifier.ts       caution-biased heuristic classifier
│   ├── cohort.ts           k-anonymous cohort blender
│   ├── router.ts           input + fetch checkpoints with hard invariants
│   ├── anthropic.ts        Anthropic adapter
│   ├── openai-compat.ts    Ollama / LM Studio / llamafile / vLLM (SSE streaming)
│   ├── webllm.ts           in-browser WebLLM adapter
│   ├── transformers-js.ts  on-device embed + zero-shot classifier + NER
│   └── zerotvm.ts          experimental secret-tier-eligible backend
└── docs/VEIL.md            full design spec
```

## Status

WIP — neither half is "done":

- **Rust** is at Phase 0.5b (regex detector + ProviderClient wrapping + streamed reverse-map). Phase 1 swaps `RegexDetector` for a learned detector against a local inference server.
- **TypeScript** ships the adapters + tier router, but the tier-enforcement hook against a real MCP / proxy server is still unfinished.
- The two halves don't share a runtime yet. Pick one as canonical or maintain both with the shared spec in [`docs/VEIL.md`](./docs/VEIL.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
