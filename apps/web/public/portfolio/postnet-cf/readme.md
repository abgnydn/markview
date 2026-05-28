# postnet-cf

**Live demo:** https://postnet-cf.abgunaydin94.workers.dev — open in two browser tabs to see the swarm form. *(May be temporarily 500 if the Durable Objects free-tier daily quota is exhausted by verifier load — see `docs/OPEN_QUESTIONS.md`. Local `wrangler dev` always works.)*

Federated learning where workers are browser tabs and the coordinator is a Cloudflare Durable Object. Four protocol variants share the substrate — federated Adam, float-weight tournament, ternary-weight tournament, and a real-ML char-LM with sliding-window byzantine defense.

```bash
npm install
npx wrangler dev --port 8787
# → open http://localhost:8787 (or /dashboard.html for all four side-by-side)

# Share with friends as cross-machine peers (requires cloudflared):
bash scripts/expose.sh
# → prints a *.trycloudflare.com URL — anyone who opens it joins the same swarm
```

## What's in here

| route | what | phase |
|---|---|---|
| `/` | federated Adam (gradient averaging) on 2D wave/circle/xor | baseline |
| `/tournament.html` | flip-and-accept (float weights), delta-only broadcasts, R2 binary snapshots | 1-3 |
| `/ternary.html` | ternary-weight tournament, 2-bit packed snapshots | 4 |
| `/lm.html` | char-LM (context-2 MLP) with federated data shards, byzantine defense, WS push | 5-14 |
| `/dashboard.html` | all four demos in one screen, live polled from each DO | 11 |

All four pages are independent Durable Objects sharing the same Cloudflare project (`src/worker.ts` routes; `wrangler.jsonc` declares 4 DO bindings + 1 R2 bucket). Each round of every protocol is a real distributed step: real workers, real coord aggregation, real bandwidth on the wire.

## Headline results

- **Bandwidth scaling.** Phase 2 (delta-only) makes per-tick downlink **O(1)** in model size after a one-time bootstrap. Phase 6 (sharded snapshots) makes the bootstrap parallelizable, scaling to model sizes that don't fit in a single 100 MB Worker response. At BitNet 2B ternary (~282 MB) the per-tick payload is still ~340 B; the bootstrap is one R2 range-read.
- **Byzantine tolerance at 50%.** Phase 9-14 defense (verify reported delta against the real global delta; quarantine workers exceeding 40% fraud rate on a 20-win sliding window) holds convergence within +0.09 nats of baseline at 50% byzantine share (3 honest + 3 attackers). See `docs/EMPIRICAL_STUDY.md`.
- **Real ML loss.** The char-LM (Phase 8: context-2 MLP, P = 2 379) converges from random-init `log(V) ≈ 3.30` down to ~1.65 nats with real text diversity at R2000 — entirely via federated flip-and-accept on the cross-entropy surface, no gradients, no autograd.
- **Real federated semantics.** Phase 7 splits the training text into disjoint shards by `workerId` hash. Each worker only scores proposals on its own 1/3 slice. The shared model still converges (1.85 ± 0.09 nats vs centralized 1.30 ± 0.03 nats), and a worker behind a hostile network never reveals its data — only the flips it proposed.

## Phase progression

| phase | what | commit |
|---|---|---|
| 1 | Float flip-and-accept tournament | `364a2ec` |
| 2 | Delta-only broadcasts via `applied_since` | `9f27c7d` |
| 3 | R2 binary snapshot bootstrap | `43e5676` |
| 4 | Ternary weights (packed 2 bits/param) | `107a43d` |
| 5 | Char-LM bigram (real ML loss) | `60fc2bc` |
| 6 | Sharded snapshots, parallel R2 fetch | `bf2112c` |
| 7 | Federated data shards (per-worker private slices) | `6134a2d` |
| 8 | Context-2 MLP (escapes bigram mode collapse) | `8c33df5` |
| 9 | Byzantine fraud detection + quarantine | `804517e` |
| 10 | WebSocket push for low-latency updates | `ff670ea` |
| 11 | `/dashboard.html` unified view | `ea54e55` |
| 12 | Multi-seed empirical study | `9cf96fa` |
| 13 | Attacker-count sweep — defense holds at 50% byzantine | `69ddc28` |
| 14 | Sliding-window fraud detection (defends against patient attackers) | `f935e22` |
| 15 | README polish | `d7aca33` |
| 16 | Byzantine defense + WS push ported to Tournament | `f2742b6` |
| 17 | Byzantine defense + WS push ported to Ternary | `02d58ab` |
| 18 | Browser workers consume WS push (tournament + ternary) | `492ca66` |
| 19 | Smoke-test runner + verifier retry logic | `5ecef4e` |
| 20 | Protocol specification (`docs/PROTOCOL.md`) | `74ad6de` |
| 21 | `scripts/expose.sh` — cloudflared quick tunnel | `3858e64` |
| 22 | Trimmed-mean defense for federated Adam | `bc02682` |
| 23 | Interactive byzantine demo on `/lm.html` | `b8e8e69` |
| 24 | README phase table caught up to phase 23 | `8b403a7` |
| 25 | arXiv-style paper draft (`docs/PAPER_DRAFT.md`) | `db3a78c` |
| 26 | **DEPLOYED** to `*.workers.dev` | `39b5bbd` |
| 27 | README deploy section — R2 prerequisite | `58ba265` |
| 28 | `docs/OPEN_QUESTIONS.md` — research-direction inventory | `8e59a8b` |
| 29 | `docs/README.md` — doc-folder entry point | `1228723` |
| 30 | `CLAUDE.md` with `Resume here` block for future sessions | `98d6d89` |
| 31 | Tiered fraud-detection windows (defends against patient-patient attackers) | `c19fddf` |
| 32 | Production finding: DO free-tier daily quota | `35a2c70` |
| 33 | localStorage-cached bootstrap for char-LM | `dd723ae` |
| 34 | README phase table catchup through phase 33 | `4d50402` |
| 35 | WebGPU substrate for char-LM scorer (`public/lm-webgpu-scorer.js` + parity test) | `440dfb7` |
| 36-37 | SPSA tournament char-LM (DeComFL fusion) + scaling crossover empirical — SPSA wins past P ~ 30K (see `docs/PHASE_37_SCALING.md`) | `008b20a` |
| 38 | Federated head-classifier on real MiniLM features — SPSA outperforms flip-and-accept at P=50K, real downstream task (see `docs/PHASE_38_HEAD.md`) | `0a7829c` |
| 39 | Adaptive η on SPSA tournament — symmetric AIMD beats fixed-η: 1.84× loss descent, +16 pp acc (R=90). MEAZO claim supported (see `docs/PHASE_39_ADAPTIVE_ETA.md`) | `4c6cb26` |
| 39b | Adam-on-scalar (MEAZO-faithful) — bounded step caps at lr; loses to sym-AIMD with default hyperparams (see `docs/PHASE_39B_ADAM_ON_SCALAR.md`) | `f73fe22` |
| 40-scope | NTK-Mirror local dry-run + integration plan — Qwen2.5-0.5B + 512 gates trained in 5 s, controller artifact dissected, Phase 40 ship sequence written (see `docs/PHASE_40_NTKMIRROR_PLAN.md`) | `b8d6ce6` |
| 40-1 | Gate-selection pipeline — Python extractor + TS gate-apply hook + first baked artifact (Qwen-0.5B math, K=5000, 40 KB); parser round-trip verified across 16 checks | `08aa9b5` |
| 40-2 | Federated NTK-Mirror controller DO + Python verifier — first end-to-end federated SPSA on a real LLM; R=30 → loss 1.7632→1.7629, ‖θ‖ 0→0.044 (see `docs/PHASE_40_NEXT2_NTK_DO.md`) | `00fda9e` |
| 40-3 | Trusted-auditor loss oracle — reactivates Phase 39 sym-AIMD η + byzantine defense via piggybacked `audit_loss_before` field; R=30 → η drifts 1.0e-3→2.5e-3 (grow=19 shr=0), 1.75× more loss descent (see `docs/PHASE_40_NEXT3_LOSS_ORACLE.md`) | `91fb1c1` |
| 40-4a | Browser worker for head-classifier — `public/head.html` + `public/head-spsa-worker.js`; completes the Phase 38/39 demo arc (open a URL, click Join, federate-train an AG News classifier in your tab) | `ae9541c` |
| 40-4b-s1 | Qwen+gates ONNX export — `scripts/export-qwen-with-gates.py` produces a Qwen-0.5B-Instruct ONNX with per-layer gate multipliers as a forward input; validated zero-diff vs base PyTorch at all-ones gates (see `docs/PHASE_40_NEXT4B_QWEN_ONNX.md`) | _uncommitted_ |

Each phase ships a real change to the protocol or the demo and is documented either in `docs/` or in a per-phase commit message that includes the empirical result.

## Verifier scripts

| script | what |
|---|---|
| `scripts/headless-worker.mjs` | Federated Adam (the `/` demo) |
| `scripts/tournament-verifier.mjs` | Float tournament (Phase 1-3) |
| `scripts/ternary-verifier.mjs` | Ternary tournament (Phase 4) |
| `scripts/lm-verifier.mjs` | Char-LM with optional `BYZANTINE=1` attacker |
| `scripts/empirical-study.mjs` | Multi-seed comparison (`MODE=variants`, `attackers`, `smart`) |
| `scripts/bandwidth-sweep.mjs` | Static scaling analysis (no live coord needed) |

All headless verifiers expect `wrangler dev` running on port 8787.

---

## Original (Phase 0) — federated Adam

A 129-parameter 2D classifier trained by federated SGD across whatever browser tabs you open. Each tab computes the gradient of BCE loss on its local synthetic batch (manual backprop, ~50 lines of JS), POSTs the gradient to the coord, the coord averages all gradients in the round's pool and applies an Adam step. State lives in a single Durable Object; θ is JSON-blobbed in every tick response.

Architecture:

```
browser tab #1   browser tab #2   browser tab #N
   ∇L on            ∇L on            ∇L on
   local batch      local batch      local batch
       │                │                │
       └────────┬───────┴────────┬───────┘
                │ POST /api/tick │
                │  { gradient }  │
                ▼                ▼
       ┌────────────────────────────┐
       │  Cloudflare Worker         │
       │   → routes /api/* to       │
       │     idFromName("default")  │
       └────────────────────────────┘
                       │
                       ▼
       ┌────────────────────────────┐
       │  Coord (Durable Object)    │
       │   pool: gradients          │
       │   when |pool| ≥ 2:         │
       │     avg = mean(pool)       │
       │     v ← βv + avg           │
       │     θ ← θ − lr·v           │
       │     round++                │
       │   broadcast new θ          │
       └────────────────────────────┘
```

## Results

- Local demo, **3–6 browser tabs**, ~5 rounds/sec
- **Loss 0.69 → 0.06** in ~400 rounds (≈ 80 sec wall clock)
- Decision boundary visibly bends to track `sin(2x) > y`
- Per-round bandwidth: 129 floats × 4 bytes ≈ 520 B gradient + 520 B θ broadcast
- Coordinator state: single Durable Object, in-memory pool, capped history

## What worked (and what didn't)

This project went through three algorithms before the boundary actually bent:

1. **ES with σ=0.1**: loss plateaued at 0.32 (y-only local minimum), 1011 rounds
2. **ES with σ_init=0.5 decaying to 0.05**: same plateau, same minimum — ES on this objective genuinely can't escape the y-only basin from random init
3. **FedSGD, plain SGD lr=0.1**: also plateaued at 0.31. The y-only basin is *that* attractive on uniform-2D sin data — ~85% of samples are already correct under "predict y<0", so the gradient signal pulling toward x-dependence is weak and gets buried
4. **FedSGD with momentum (β=0.9), lr=0.3** → ✅ **converged**. Effective LR is ~3.0 at steady state, big enough to escape

Lesson: optimization choices matter at least as much as the protocol. The substrate (CF DO + browser workers) is identical across all four; only the math differed.

## Run locally

```bash
npm install
npx wrangler dev --port 8787
# → open http://localhost:8787 in 2+ tabs, click Join in each
```

## Deploy

```bash
# One-time: create the R2 buckets the wrangler.jsonc binding references
npx wrangler r2 bucket create postnet-snapshots
npx wrangler r2 bucket create postnet-snapshots-preview

# Then:
npx wrangler deploy
# → CF gives you a *.workers.dev URL; share with a friend, they become a worker
```

Total upload is ~50 KB (gzip 8 KB) including all 4 demos, 4 DO classes, and dashboard. The deploy works on the Cloudflare free tier — DOs, R2, and Workers all have generous free quotas for a demo of this size. Production handles aggressive verifier load that `wrangler dev` can't sustain.

## File layout

| file | role |
|---|---|
| `src/worker.ts` | Worker entrypoint + Coord Durable Object (test-loss eval, gradient averaging, SGD+momentum, /api/tick + /api/state + /api/reset) |
| `public/index.html` | UI (loss chart + boundary canvas + log panel) |
| `public/worker.js` | Browser worker: forward, manual backprop, POST loop, boundary rendering |
| `wrangler.jsonc` | CF config: name, main, assets binding, Durable Object binding, SQLite-backed migration |

## Tasks

Three synthetic 2D objectives the same architecture trains on (selectable from the UI dropdown):

| task | rule | difficulty |
|---|---|---|
| `wave` | `sin(2x) > y` | hardest — y-only basin attracts SGD; needs Adam/momentum to escape |
| `circle` | `x² + y² < 1` | easy — radial structure, ReLU MLP nails it in ~30 rounds |
| `xor` | `sign(x) ≠ sign(y)` | medium — the canonical "must use both inputs" test |

Switching the task via the UI dropdown resets the coordinator (θ, Adam moments, history). Browsers fetch the active task in every tick and label their batches accordingly.

## Configuration

Edit the constants at the top of `src/worker.ts`:

- `H = 32` — hidden width (P = 4H+1 = 129 params)
- `TARGET_GRADIENTS = 2` — pool size before Adam step (advance round)
- `LR = 0.05` — Adam learning rate
- `ADAM_B1 = 0.9`, `ADAM_B2 = 0.999`, `ADAM_EPS = 1e-8`

Browser-side constants in `public/worker.js`:

- `BATCH_SIZE = 64` — synthetic samples per local gradient
- `POLL_DELAY_MS = 80` — pause between worker tick loops

## Tournament protocol (fusedx integration)

The same task with a different aggregation shape: instead of every worker sending a gradient and the coord averaging them, every worker locally tries `K = 8` random flips of `4` parameters, scores each on its private batch, and submits just its **single best** `(indices, values, Δloss)`. The coord picks the best across all workers in the round and applies it.

UI at `/tournament.html`. Same task selector, same boundary canvas; new stats for accept rate and live bandwidth, plus green ticks on the chart marking applied rounds.

```bash
node scripts/tournament-verifier.mjs   # smoke-test the protocol
```

### Phase 1 — flip-and-accept tournament

Per-worker per-round payload at P = 129:

| protocol | up | down |
|---|---|---|
| federated Adam | ~530 B (gradient) | ~530 B (full θ) |
| Phase 1 tournament | ~36 B (flip) | ~530 B (full θ) |

Headless verifier (3 workers × 400 rounds): circle 0.07 ✓ · xor 0.07 ✓ · wave 0.21 △

### Phase 2 — delta-only broadcasts

Workers bootstrap θ once via `/api/tournament/snapshot`, then maintain `localTheta` by applying each tick response's `applied_since` (the list of flips applied since the worker's last sync). The coord no longer ships full θ in tick responses.

Per-worker per-round payload at P = 129 (this demo):

| protocol | up | down | scales with P? |
|---|---|---|---|
| federated Adam | 4·P + ~70 B | 4·P + ~70 B | **yes** (both) |
| Phase 1 tournament | flip + ~50 B | 4·P + ~70 B | down only |
| Phase 2 tournament | flip + since + ~30 B | ~N_flips·40 + ~80 B | **no** (after bootstrap) |

Per-worker per-round measured by the headless verifier:

| protocol | up | down |
|---|---|---|
| Phase 1 tournament | ~120 B | ~470 B (theta dominates) |
| Phase 2 tournament | ~235 B (includes since_round + ack) | ~680 B (JSON-heavy on this tiny model) |

At P = 129 Phase 2 is *not* a bandwidth win — JSON envelope overhead dominates. The point is the **scaling**:

|   | downlink at P = 129 | downlink at P = 1M | downlink at P = 500M (BitNet 2B) |
|---|---|---|---|
| federated Adam / Phase 1 | ~520 B | ~4 MB | ~2 GB (exceeds Worker response cap) |
| Phase 2 | ~680 B | ~680 B | ~680 B |

Convergence is unchanged (3 workers × 400 rounds): circle 0.10 ✓ · xor 0.08 ✓ · wave 0.23 △.

Drift handling: each worker sends its `localRound` as `since_round`. Server returns every applied flip with `round >= since_round`. If the coord's `appliedHistory` has been truncated past the worker's last sync (cap 1000), the worker detects via `oldest_applied_round > localRound + 1` and re-bootstraps via `/snapshot`.

### Phase 3 — R2 snapshots + binary bootstrap

The bootstrap snapshot moves to R2 with versioned keys. The `/api/tournament/snapshot` endpoint returns a JSON pointer; workers fetch the actual θ from `/api/tournament/snapshot.bin?round=N`, which serves the bytes from R2 (or in-memory fallback if R2 is cold). Wire format is binary: `[uint32 round][uint32 P][P × float32]`. Snapshot re-published every 50 accepted rounds so fresh workers don't have to replay the entire history.

Bandwidth scaling, measured by `node scripts/bandwidth-sweep.mjs` (wire-format bytes, includes JSON envelope):

| H | P | Adam ↓/tick | Phase 1 ↓/tick | Phase 2 ↓/tick | Bootstrap binary |
|---|---|---|---|---|---|
| 32 | 129 | 1.7 KB | 1.8 KB | 339 B | 524 B |
| 128 | 513 | 6.4 KB | 6.5 KB | 339 B | 2.0 KB |
| 512 | 2,049 | 24.1 KB | 24.2 KB | 340 B | 8.0 KB |
| 2048 | 8,193 | 99.8 KB | 100.0 KB | 340 B | 32.0 KB |
| 8192 | 32,769 | 509.0 KB | 509.2 KB | 341 B | 128.0 KB |
| BitNet 2B | 1.5B | ~282 MB (overflows Worker 100 MB response cap) | same | 337 B (constant) | 282 MB via R2 range read |

At 8192-hidden-unit models, Phase 2 is **~1,500× smaller** than Adam or Phase 1 per tick. At BitNet 2B, the linear protocols don't fit in a Worker response at all — Phase 2 still ships ~340 B/tick because the wire payload is the accepted flip and a small JSON envelope, not the model.

R2 setup: `wrangler.jsonc` declares an `R2_BUCKET` binding named `SNAPSHOTS`. Local `wrangler dev` emulates R2 automatically; for `wrangler deploy` create the bucket once:
```bash
npx wrangler r2 bucket create postnet-snapshots
```

The DO writes snapshots via `env.SNAPSHOTS.put(key, buf, ...)` and reads via `env.SNAPSHOTS.get(key)`. Response headers `x-snapshot-source: r2 | memory` make it easy to verify which path served the bytes.

### Phase 4 — ternary weights

Same flip-and-accept protocol but every weight is constrained to <code>{−1, 0, +1}</code> with a single learned scale `S`. Effective weight at index *i* is `sign[i] * scale`. Workers propose ternary flips (pick K positions, set each to a new value ≠ current), score, submit best. Substrate test for plugging in a real BitNet b1.58 model as Phase 5.

UI at `/ternary.html`. New DO `Ternary` (migration v3); endpoints `/api/ternary/{tick,state,reset,set_task,snapshot,snapshot.bin}`.

Snapshot wire format (packed):
```
[uint32 round][uint32 P][float32 scale][ceil(P*2/8) bytes packed]
```
Each ternary value packs into 2 bits: `00 = 0`, `01 = +1`, `10 = −1`. At `P = 129` the snapshot is **45 bytes** (vs 524 B for the float Tournament — 11.6× smaller). At BitNet 2B (`P = 1.5B`) the same encoding ships **~375 MB** once via R2 (vs ~6 GB float32 — 16× smaller).

Headless verifier (`scripts/ternary-verifier.mjs`, 3 workers × 800 rounds): circle 0.34 △ · xor 0.31 △ · wave 0.30 △. Convergence stops short of the float Tournament's 0.07-0.21 because the ternary search space is genuinely coarser at P=129 — there are only 3^129 reachable weight configurations and a single scale. Accept rate drops to ~25% (vs ~50% for float) because many proposed flips don't beat the current state; each accepted flip is a discrete improvement.

At BitNet 2B scale the same protocol drives 1.5 B ternary weights with the same ~340 B per-tick downlink. Phase 6 will swap the worker's local scorer for `fused-lora`'s WebGPU BitNet inference, keeping the protocol and DO unchanged.

### Phase 5 — char-LM (real ML task)

Steps the substrate up from the 2D toy classifier to a real ML task: next-character prediction over a fixed 340-char toy passage. Architecture is a 27-vocab bigram: `embed (V × E) + linear (E × V) + bias (V)` = 27·16 + 16·27 + 27 = **891 params**. Loss = mean cross-entropy. Random-init loss ≈ `log(V) ≈ 3.30`.

UI at `/lm.html`. New DO `TournamentLM` (migration v4); endpoints `/api/lm/{tick,state,reset,snapshot,snapshot.bin,sample}`. The `/sample` endpoint runs greedy + temperature decoding from the coord's current θ — handy for eyeballing convergence without joining a worker.

Headless verifier (`scripts/lm-verifier.mjs`, 3 workers × 1500 rounds):

| round | loss | accept rate | sample (60 chars from "t") |
|---|---|---|---|
| 0 | 3.29 | 0% | `"txhozciuicxcczuxhcziczhxhchnuczhczihcihzizixchch zuxczuxuxwi"` |
| 400 | 2.23 | 50% | `"the the the the the the the the the the the the the the the "` |
| 800 | 1.84 | 49% | `"the the the the the the the the the the the the the the the "` |
| 1500 | 1.67 | 45% | `"the the the the the the the the the the the the the the the t"` |

Loss drops monotonically from 3.29 → 1.67 driven entirely by federated flip-and-accept on a real ML loss surface (no gradients, no autograd). The mode collapse to "the the the…" is expected for a 1-char-context bigram — it has no notion that it just emitted the same word three times. Phase 6 (BitNet b1.58 via fused-lora) brings real context length and breaks out of the mode-collapse regime; the protocol stays the same.

### Phase 6 — sharded snapshots (parallel bootstrap)

`/api/lm/snapshot` now returns a **manifest** listing N shards instead of a single binary URL. Each shard is its own R2 key (`lm/r{N}/shard{K}.bin`); workers fetch them all in parallel via `Promise.all` and assemble the local θ. The first shard carries the 8-byte `[round, P]` header; subsequent shards are raw `float32` payloads.

```bash
$ curl -s localhost:8787/api/lm/snapshot | jq '.num_shards, .shards | length'
4
4
```

At P = 891 with `SHARD_SIZE = 1 KB` the snapshot splits into 4 shards (256 + 256 + 256 + 123 floats). Reassembly in the worker via parallel fetch + sorted `Float32Array.set()`. Bootstrap latency is now bound by the slowest single shard, not the total bytes.

The point: the Cloudflare Worker response cap is 100 MB. At BitNet 2B scale (~282 MB ternary) a single-shot snapshot fetch is impossible — the bootstrap *must* be sharded. Production sharding would use `SHARD_SIZE ≈ 64 MB` for BitNet (∼5 shards × 64 MB), keeping each below the cap while parallelizing the wall-clock. The demo uses tiny 1 KB shards purely to exercise the assembly logic at small P.

Response headers `x-snapshot-shard: K` and `x-snapshot-source: r2 | memory` make it easy to verify the right shard was returned from the right path.

### Phase 7 — federated data shards (true FL)

Up through Phase 6 every worker scored proposals on the **same** text (the full 340-char passage). Phase 7 splits the text across workers: each tab hashes its `workerId` to a deterministic disjoint slice and scores proposals only on its private shard. The coord still measures convergence on the **full** text — that's the metric that matters — but no individual worker has seen all the data.

With 3 workers covering 3 disjoint shards (chars 0..112, 112..224, 224..336):

```
lm-alpha   → shard 0  [chars   0..112]
lm-delta   → shard 1  [chars 112..224]
lm-bravo   → shard 2  [chars 224..336]
```

Convergence on full text (3 workers × 1500 rounds): 3.27 → 1.94 (vs the centralized 1.67). Slightly worse because each worker's gradient estimate is noisier from only seeing 1/3 of the data — but the shared model still learns the union of the shards via federated flip-and-accept.

This is real FL semantics: workers cannot see each other's data, the coord aggregates only the proposed *parameter updates*, and the global model fits the union of private datasets. Combined with Phase 2's delta-only broadcasts, a worker behind a hostile network can participate without ever revealing what it trained on — only the flips it proposed.

### Phase 8 — context-2 MLP (escapes the bigram mode collapse)

Phase 5's bigram couldn't beat the "the the the…" attractor — a 1-char-context model has no notion of what it just emitted. Phase 8 swaps in a real two-char-context MLP: `embed (V×E) + fc1 (2E×H) + relu + fc2 (H×V) + biases`, with V=27, E=16, H=32, CTX=2 → **P = 2 379 params**. Same protocol, same DO, same R2 sharded snapshots (now 10 shards at 1 KB each).

Convergence on full text (3 workers × 3 disjoint shards × 2000 rounds): 3.32 → 1.63. At R2000 the sample produces real diversity — `"the slin the slin the wh the soge slin…"` — pseudo-words that respect the 2-char Markov structure of the training text. Mode collapse broken.

### Phase 9 — Byzantine fraud detection (and defense)

Every protocol so far trusted the worker's reported `delta` blindly. A malicious worker can sabotage training by submitting a random flip but claiming a hugely negative delta — it always "wins" the tournament, and the coord applies its bad flip every round. We saw the attack work: with no defense, **adding one byzantine worker raised final loss from 1.63 → 2.35**.

Defense: the coord already computes `testLoss(theta)` after applying a flip. Compare to `lastLoss` before applying — that's the *real* global delta. A worker that wins with a claimed `delta < 0` but whose flip actually raises global loss is a fraud. After 10 wins, if **> 40% of them were frauds**, that worker is quarantined — its future proposals are skipped entirely.

```
$ ROUNDS=1500 BYZANTINE=1 node scripts/lm-verifier.mjs
...
worker_stats:
  lm-alpha   wins= 400  frauds=  70  (17.5%)
  lm-delta   wins= 430  frauds=  97  (22.6%)
  lm-bravo   wins= 456  frauds= 119  (26.1%)
  lm-byz     wins= 214  frauds=  86  (40.2%)   ← detected & quarantined
```

Honest workers also have a "fraud" rate (~17-26%) because each worker's shard-local delta doesn't perfectly correlate with the global delta — those are false positives from data heterogeneity, not real attacks. The signal is the gap: honest sits around 20%, malicious lands at 40%+. Convergence recovers from 2.35 (no defense) → 1.82 (defended) → 1.63 (honest-only baseline).

This connects to the federated-Byzantine-tolerance work in [The Swarm](https://github.com/abgnydn/swarm-engine) — same principle (verify the claimed result against an independent measurement), different protocol layer.

## Open questions / future moves

- **Real workload.** Swap the synthetic 2D classifier for `fusedx`'s `gpt-gradfree-engine.ts` or a TF.js MNIST model. Same coord, real ML compute.
- **Cross-machine demo.** After `wrangler deploy`, send the URL to a friend. Watch their machine become peer #N.
- **Real federated angle.** Currently every tab samples from the same synthetic distribution. For "true" FL, give each tab a different shard or different data domain.
- **DKIM / Postnet bridge.** Wire this same coord shape to the email-based Postnet transport so the system tolerates workers behind hostile networks where outbound HTTPS doesn't reach Cloudflare.
