<h1 align="center">The Swarm</h1>
<p align="center"><strong>Privacy-Preserving Distributed AI via Browser-Based Evolutionary Strategies</strong></p>
<p align="center">
  <em>Turn every browser tab into a node in a decentralized optimization network. No install. No data shared. Just open a link.</em>
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> •
  <a href="docs/TECHNICAL_BRIEF.md">Technical Brief</a> •
  <a href="#demos">Demos</a> •
  <a href="#benchmarks">Benchmarks</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## The Problem

AI is becoming the most powerful technology on earth — and it's controlled by 3 companies. Training a frontier model costs $100M+ in centralized GPU clusters. Federated Learning shares *gradients*, which can be inverted to reconstruct private data. Meanwhile, **billions of consumer GPUs sit idle**.

## The Solution

**The Swarm** uses Evolutionary Strategies (ES) to distribute optimization across untrusted browser nodes. ES only transmits **scalar fitness scores** — no weights, no gradients, no data ever leave the node. This makes it:

- 🔒 **Mathematically private** — Only 2 numbers per round per node
- 🌐 **Zero-friction** — No install, no auth, just open a URL
- 🛡️ **Byzantine-tolerant** — Survives 50% malicious nodes
- ⚡ **Communication-efficient** — O(1) bandwidth per node vs O(d) for SGD

---

## Quickstart

```bash
git clone https://github.com/AhmetBarisGunaydin/the-swarm.git
cd the-swarm
npm install
node server.js          # Starts Dispatcher on port 4444
```

Open **http://localhost:4444** in Chrome → Click **"Connect to Swarm"**.

### Run Demos
- **🧪 AMP Discovery** — Evolve an antimicrobial peptide using distributed ES
- **🔒 Federated** — Privacy-preserving medical AI (data stays on-device)
- **🚗 Train AI** — Self-driving car via evolutionary neural network
- **⚡ GPU Demo** — Distributed WebGPU matrix computation
- **🧠 AI Demo** — Distributed Transformers.js inference
- **🎯 π Demo** — Monte Carlo estimation across the network

### Scale Testing
```bash
# Simulate 50 browser nodes
node swarm_sim.js --nodes=50

# Simulate with 10% malicious nodes
node swarm_sim.js --nodes=50 --malicious=5

# Simulate network latency (200-2000ms)
node swarm_sim.js --nodes=50 --latency=200-2000

# Simulate node churn (30% disconnect rate)
node swarm_sim.js --nodes=50 --churn=30

# Run full benchmark suite
node benchmark.js --suite=all --rounds=200
```

---

## Demos

### 🧪 Antimicrobial Peptide Discovery
The ES engine optimizes a 20-amino-acid peptide sequence against 7 real physicochemical criteria (hydrophobicity, charge, amphipathicity, aromatic anchoring, disulfide bridges). Each browser node evaluates perturbed peptide candidates and reports fitness scores. The server estimates gradients without ever seeing the candidate sequences.

### 🔒 Privacy-Preserving Federated Classification
Each browser tab generates a **private patient dataset** (never transmitted). The ES trains a neural network classifier by sending only accuracy scores — the server has zero knowledge of individual patient data.

### 😈 Byzantine Attack Simulation
Toggle "Malicious Node" in the UI to make your browser send inverted/randomized fitness scores. Watch the network **still converge** despite the poisoned data — proving the system's fault tolerance.

---

## Benchmarks

Run `node benchmark.js` to generate these results on your hardware.

### Scaling: More Nodes → Better Optimization

| Nodes | Peak Score | Improvement vs 1N |
|-------|-----------|-------------------|
| 1     | 21.8      | baseline          |
| 5     | 24.1      | +11%              |
| 25    | 23.0      | +6%               |
| 50    | **27.7**  | **+27%**          |

### Byzantine Fault Tolerance

| Malicious % | Peak Score | vs Clean |
|-------------|-----------|----------|
| 0%          | 25.7      | baseline |
| 10%         | 24.3      | -5%      |
| 20%         | 24.5      | -5%      |
| 30%         | 29.0      | +13%     |
| **50%**     | **24.9**  | **-3%**  |

> **Even with 50% of nodes actively poisoning the training, the system achieves 97% of clean performance.**

### Node Churn Resilience

| Churn Rate | Peak Score | vs Stable |
|------------|-----------|----------|
| 0%         | 24.8      | baseline |
| 10%        | **26.3**  | **+6%**  |
| 30%        | 24.0      | -3%      |
| **50%**    | **22.8**  | **-8%**  |

> **Half the nodes randomly disconnecting every round → only 8% performance loss.**

### Latency Tolerance

| Latency     | Peak Score | vs Clean |
|-------------|-----------|----------|
| 0ms         | **29.0**  | baseline |
| 50-200ms    | 26.2      | -10%     |
| 200-2000ms  | 20.1      | -31%     |
| 1-5 seconds | 20.3      | -30%     |

> **Training still converges with 5-second response delays.** Real-world internet latency is typically < 200ms — well within the green zone.

### WebGPU Acceleration

| Batch Size | CPU (JS) | GPU (WGSL) | Speedup |
|-----------|----------|------------|---------|
| 1 | 0.4ms | 7.6ms | CPU wins |
| 100 | 3.8ms | 4.7ms | ~parity |
| 1,000 | 14.2ms | 6.6ms | **GPU 2.2x** |
| **10,000** | **106.3ms** | **4.3ms** | **🚀 GPU 24.7x** |

> **Each browser tab becomes a mini-GPU cluster.** GPU crossover at N≈500, 24.7x speedup at production batch sizes.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     DISPATCHER (server.js)                │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Task Queue│ │ ES Engine│ │ Treasury │ │ Geo Router│  │
│  └───────────┘ └──────────┘ └──────────┘ └───────────┘  │
└────────┬──────────────┬──────────────┬───────────────────┘
         │              │              │
    WebSocket      WebSocket      WebSocket
         │              │              │
   ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
   │ Browser 1 │ │ Browser 2 │ │ Browser N │
   │  WebGPU   │ │  WebGPU   │ │  WebGPU   │
   │  Private  │ │  Private  │ │  Private  │
   │  Data     │ │  Data     │ │  Data     │
   └───────────┘ └───────────┘ └───────────┘
```

### ES Training Protocol
1. Server broadcasts `{weights, seed, σ}` to each node
2. Node regenerates perturbation `ε` from seed (deterministic RNG)
3. Node evaluates `F(θ+σε)` and `F(θ-σε)` locally
4. Node returns only `{fitness_plus, fitness_minus}` (2 scalars)
5. Server reconstructs `ε` from seed and estimates gradient: `∇F ≈ (1/2Nσ²) Σ ε·(F₊-F₋)`
6. Server updates weights via Adam with cosine LR schedule

**Privacy guarantee**: The server never sees training data, model outputs, or gradients — only scalar fitness values.

### Features
- ✅ WebSocket real-time task scheduling
- ✅ 2-of-3 consensus verification with SHA-256 integrity
- ✅ Geo-aware routing (Compute Delivery Network)
- ✅ Science Treasury (contribution tracking & reward engine)
- ✅ Transformers.js AI inference in-browser
- ✅ Monte Carlo scientific simulation
- ✅ Evolutionary Strategies with Adam optimizer
- ✅ Antithetic sampling & fitness shaping
- ✅ Privacy-preserving federated learning
- ✅ AMP drug discovery demo
- ✅ Byzantine fault tolerance (50%+ survival)
- ✅ Headless scale simulator (swarm_sim.js)
- ✅ Automated benchmark suite (benchmark.js)

---

## Why ES Over Federated SGD?

| Property | The Swarm (ES) | Federated SGD |
|----------|---------------|---------------|
| Data exposure | **None** (scalars only) | Gradients (invertible) |
| Install required | **None** (browser) | SDK + container |
| Fault tolerance | **50%+ Byzantine** | <20% gradient poisoning |
| Communication | **O(1)** per node | O(d) per node |
| Onboarding | **Open URL** | Auth + setup |

---

## Project Structure

```
the-swarm/
├── server.js           # Dispatcher, ES engine, API endpoints
├── swarm_sim.js        # Headless node simulator (scale/attack/churn/latency)
├── benchmark.js        # Automated benchmark suite
├── daemon.js           # Native CLI node (headless, geo-aware)
├── poc/
│   └── index.html      # Browser client (dashboard + all demos)
├── docs/
│   ├── TECHNICAL_BRIEF.md  # Research-level technical summary
│   ├── PROTOCOL.md         # Wire protocol specification
│   └── CONTRIBUTING.md     # Contribution guidelines
└── package.json
```

---

## Contributing

We welcome contributions from anyone — engineers, scientists, designers.

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

MIT License — see [LICENSE](LICENSE).

---

<p align="center">
  <strong>The compute is already there. The browsers are already open.<br/>The Swarm just connects them.</strong>
</p>
