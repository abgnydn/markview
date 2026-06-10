# veil

> A privacy layer between your app and any third-party LLM. The model sees `EMAIL_1`; the user sees `alice@acme.com` back.

**🌐 [veil-7xs.pages.dev](https://veil-7xs.pages.dev/)** — what it does, in one page.

[![CI](https://github.com/abgnydn/veil/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/veil/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Rust](https://img.shields.io/badge/Rust-stable-orange.svg)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178c6.svg)](https://www.typescriptlang.org/)

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

LLM prompts leak PII by default. Once an email or document path goes upstream, it's logged, cached, possibly trained on. veil sits between your app and the provider, swaps real identifiers for stable pseudonyms (`EMAIL_1`, `PATH_1`, `PERSON_1`, …) before the wire, asks the model, and rewrites the answer back — including streamed tokens.

Round-trip stability is load-bearing: send "remind alice@acme.com" → model sees "remind EMAIL_1" → model says "Reminded EMAIL_1." → user sees "Reminded alice@acme.com." Across many turns of the same conversation the mapping stays consistent, so the model can reason about "the user mentioned earlier" without ever learning a real name.

## Architecture

**Rust engine + TypeScript shell.** The detect → substitute → stable-session-table → reverse-map round-trip lives in Rust (`VeilPipeline`), exposed over a loopback HTTP server. The TypeScript side is the tier router + adapter ecosystem that calls it.

```
  your app / MCP client
          │
          ▼
  VeilEnforcer (ts)  ── classify tier ──▶ public/internal: pass through
          │                               secret: local-only, else withheld
          │  private
          ▼
  RustPipelineClient ──HTTP──▶ veil_server (rust)  ──▶ HttpNerDetector ──▶ GLiNER
   pseudonymize / cohort         VeilPipeline             (person/location/org)
   reverse-map / audit           + RegexDetector          email/path/ip/url/uuid
```

| component | path | what it does |
|---|---|---|
| **engine** | `rust/` | `VeilPipeline` (pseudonymize, coref, re-ID audit, JSON tool-call walking) behind a loopback HTTP server (`veil_server`). Wire contract: [`docs/CONTRACT.md`](./docs/CONTRACT.md). |
| **learned detector** | `rust/` + `examples/gliner-detector/` | `HttpNerDetector` unions regex (structured kinds) with a GLiNER server (the freeform `person`/`location`/`org` kinds regex can't do). |
| **shell** | `ts/` | `RustPipelineClient` (typed engine client), `VeilEnforcer` (tier enforcement + cohort), `wrapWithVeil` (streaming round-trip), adapters (Anthropic, OpenAI-compat, WebLLM, …). |
| **MCP consumer** | `examples/mcp-server/` | A real MCP server exposing a `veil_ask` tool that enforces the tier algebra end-to-end. |

## Tier algebra

veil classifies content into four tiers and enforces two hard invariants **in code, not config**:

| tier | what it is | where it goes |
|---|---|---|
| `public` | safe for any provider | remote, as-is |
| `internal` | mildly identifying | remote, as-is |
| `private` | clearly identifying | remote, **pseudonymized** (optionally k-anonymized) |
| `secret` | regulated / confidential | **local only** — withheld if no local backend (never a remote LLM) |

- **Invariant 1** — `secret` content never reaches a non-local backend. Fail-closed.
- **Invariant 2** — `private` content never reaches a remote backend raw; it is pseudonymized (and, with `cohortK>1`, k-anonymized) before egress.

## k-anonymity (cohort blending)

For `private` content, pseudonymization hides the *values* but the prompt still reveals one real user. With `cohortK>1`, veil fans the prompt out alongside `k-1` siblings whose pseudonyms are drawn from a disjoint pool, then **crypto-scrambles every number into one space** so real and siblings are indistinguishable — a wire-side adversary picks the real one with probability `1/k` (entropy `log2(k)`). The real response is un-scrambled and reverse-mapped; siblings are dropped. Off by default (costs k× provider calls). See [`docs/CONTRACT.md §9`](./docs/CONTRACT.md) for the closed/open caveats.

## See it in 10 seconds

```bash
./scripts/demo.sh
```

Drives the real enforcer with a stand-in cloud provider that **records the exact
bytes it receives** — no API key, nothing sent anywhere:

```
You type:
  Email the Q3 deck at /Users/baris/q3.pdf to alice@acme.com, CC bob@acme.com …
What the cloud actually receives:        (captured off the wire, tier=private)
  Email the Q3 deck at PATH_1 to EMAIL_1, CC EMAIL_2 …      ← identifiers gone
What you get back:                       (real values restored locally)
  Done — Email the Q3 deck at /Users/baris/q3.pdf to alice@acme.com …

You type:
  deploy prod with AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY
What the cloud receives:
  ✗ nothing.  secret-tier → withheld, fail-closed.
```

## Quick start

### 1. Start the engine

```bash
cd rust
cargo run --bin veil_server                 # http://127.0.0.1:8787 (loopback only)

# optional: learned NER for person/location/org (stub mode needs no model)
GLINER_STUB=1 python3 ../examples/gliner-detector/server.py &
VEIL_DETECTOR_URL=http://127.0.0.1:8808 cargo run --bin veil_server
```

### 2a. Use it from Rust (in-process, no server)

```rust
use veil::VeilPipeline;

let mut pipe = VeilPipeline::with_default_regex();
let sanitized = pipe.pseudonymize("Remind alice@acme.com");  // "Remind EMAIL_1"
// … send `sanitized` to the model; it replies referencing EMAIL_1 …
let restored = pipe.reverse_map("Reminded EMAIL_1.");        // "Reminded alice@acme.com."
```

### 2b. Use it from TypeScript (via the engine)

```ts
import {
  RustPipelineClient,
  VeilEnforcer,
  AnthropicAdapter,
  collectText,
} from '@abgnydn/veil';

const engine = new RustPipelineClient();                     // veil_server @ 127.0.0.1:8787
const anthropic = new AnthropicAdapter({
  settings: {
    getApiKey: () => process.env.ANTHROPIC_API_KEY ?? null,
    getDefaultModel: () => 'claude-sonnet-4-6',
  },
});

const veil = new VeilEnforcer({
  engine,
  sessionId: 'conv-1',
  remote: anthropic,   // public/internal + pseudonymized private
  cohortK: 8,          // optional k-anonymity for private content
});

const r = await veil.enforce('remind alice@acme.com about the demo');
// secret with no local backend → withheld; otherwise the model never saw raw PII
console.log(r.withheld ? r.reason : await collectText(r.stream));
```

### 3. Or run the MCP server

```bash
cd examples/mcp-server && npm install && npm start    # exposes a veil_ask tool
```

## Dev

```bash
# Rust engine
cd rust && cargo test && cargo clippy --all-targets -- -D warnings

# TypeScript shell
npm ci && npm run typecheck && npm run build:ts && (cd ts && bun test)

# MCP example
cd examples/mcp-server && npm ci && bun test

# Full-stack smoke (engine + GLiNER stub: pseudonymize, reverse-map, cohort)
./scripts/e2e.sh
```

CI runs all of the above on every push.

## Layout

```
rust/
├── src/pipeline.rs       VeilPipeline — pseudonymize / reverse-map / audit
├── src/server.rs         loopback HTTP engine (the wire contract)
├── src/bin/veil_server.rs  the server binary
├── src/entities.rs       RegexDetector + EntityKind
├── src/bitnet.rs         HttpNerDetector (GLiNER/BitNet) + MergeFallback
├── src/cohort.rs         StaticPoolSynthesizer (k-anon sibling synthesis)
ts/
├── rust-client.ts        typed engine client
├── enforce.ts            VeilEnforcer — tier enforcement + cohort fan-out
├── veil-wrap.ts          streaming pseudonymize/reverse-map round-trip
├── cohort-scramble.ts    per-cohort number scramble (fingerprint defense)
├── interface.ts          VeilBackend + tier algebra
├── anthropic.ts, openai-compat.ts, webllm.ts, …   adapters
examples/
├── mcp-server/           MCP server enforcing tier algebra end-to-end
├── gliner-detector/      GLiNER NER server (real + stub modes) + eval harness
docs/
├── CONTRACT.md           engine + detector + cohort wire contract
└── VEIL.md               full design spec
```

## Status

All roadmap items are shipped; remaining work is documented hardening:

- ✅ Pseudonymization round-trip (engine + streaming reverse-map)
- ✅ Tier enforcement with fail-closed invariants (`VeilEnforcer`)
- ✅ Detection, **benchmarked honestly** on [PUPA](https://huggingface.co/datasets/Columbia-NLP/PUPA) (PAPILLON's benchmark): the default regex+GLiNER leaks **33.5%** (loses ~4.5× to PAPILLON's local-LLM rewrite). But swapping in an **[LLM-detector](./examples/llm-detector/)** behind the same `Detector` boundary drops it to **~4%** — PAPILLON-class or better, **with exact reversibility** (which PAPILLON's lossy rewrite can't do). ([details](./examples/gliner-detector/README.md))
- ✅ MCP consumer enforcing tier algebra end-to-end
- ✅ k-anonymity cohort blending (pool-range / determinism / positional fingerprints closed)
- ⏳ Deferred: content-template hiding (needs a local vector store), the timing side-channel, a published accuracy benchmark. See [`docs/VEIL.md §4.3`](./docs/VEIL.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
