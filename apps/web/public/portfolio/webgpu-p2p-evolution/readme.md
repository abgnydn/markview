# Browser-to-Browser Distributed Evolution

[![CI](https://github.com/abgnydn/webgpu-p2p-evolution/actions/workflows/ci.yml/badge.svg)](https://github.com/abgnydn/webgpu-p2p-evolution/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live demos](https://img.shields.io/badge/live-gpubench.dev/demos-6ea8ff)](https://gpubench.dev/demos)
[![Demos: 4](https://img.shields.io/badge/demos-4-orange)](#demos)

![Browser-to-Browser Distributed Evolution](social-preview.png)

Peer-to-peer evolutionary computation running entirely in the browser. WebGPU compute shaders for GPU-native evaluation. WebRTC data channels for direct genome exchange between tabs/devices. No server, no install, no CUDA.

**Live demos:** [gpubench.dev/demos](https://gpubench.dev/demos)

## Demos

| Demo | What it does | GPU workload | P2P payload |
|------|-------------|-------------|-------------|
| [Flappy Evolution](demos/flappy.html) | Neural networks learn Flappy Bird | 4,096 birds per dispatch, 22-weight NN | 22 floats (88 bytes) |
| [Rastrigin P2P](demos/rastrigin-p2p.html) | 2,000-dimensional multimodal optimization | 4,096 candidate solutions | 2,000 floats (8 KB) |
| [PETase Enzyme](demos/petase-p2p.html) | Plastic-degrading enzyme design | 4,096 protein variants, 65 positions | 65 floats (260 bytes) |
| [Neoantigen MHC-I](demos/neoantigen-p2p.html) | Cancer vaccine peptide evolution | 4,096 peptides, 9-mer across HLA alleles | 9 floats (36 bytes) |

Each demo runs a complete evolutionary loop (evaluate, select, mutate) in a single fused WebGPU compute shader. Open multiple tabs to form an island model via WebRTC.

## How P2P works

1. Tab A clicks "Connect P2P" -> generates a private room code (e.g. `flappy-a7x3k2`)
2. Tab A copies the invite link and sends it to Tab B
3. Tab B opens the link -> auto-joins the same room
4. WebRTC data channels open -> genomes flow directly between browsers
5. No genome data touches the server. The relay only handles the initial WebRTC handshake.

A "Join Public Room" button is available for open collaboration with strangers.

## P2P Results

Measured on the 2,000-dimensional Rastrigin function (N=30 independent runs per configuration, 30 seconds each, shared GPU):

| Nodes | Best Fitness | Improvement | p-value | Cohen's d |
|-------|-------------|-------------|---------|-----------|
| 1 (isolated) | -16,715 +/- 2,996 | baseline | -- | -- |
| 2 (P2P mesh) | -15,342 +/- 2,664 | **+8.2%** | 0.061 | 0.48 |
| 4 (P2P mesh) | -14,790 +/- 3,147 | **+11.5%** | **0.015** | 0.63 |

The improvement comes entirely from diversity injection via elite exchange -- not additional compute. All nodes share the same GPU. On separate machines with independent GPUs, each node maintains full throughput while also benefiting from diversity.

Cross-platform validation on NVIDIA RTX 3090 (Vulkan backend, independent GPUs via vast.ai):

| Nodes | Throughput | Best Fitness | Improvement |
|-------|-----------|-------------|-------------|
| 1 | 400 gen/s | -9,237 | baseline |
| 4 (P2P) | 381 gen/s | -7,890 | **+14.6%** |

## Architecture

```
demos/
  flappy.html          # Flappy Bird neuroevolution demo
  rastrigin-p2p.html   # Rastrigin optimization demo
  petase-p2p.html      # Enzyme design demo
  neoantigen-p2p.html  # Cancer peptide demo
  p2p.js               # Shared P2P module (WebRTC mesh + relay fallback)
  device-telemetry.js  # Shared device reporting
  demo-shared.css      # Shared styles
  engine.js            # Flappy Bird GPU evolution engine
  petase_engine.js     # PETase GPU evolution engine
  neoantigen_engine.js # Neoantigen GPU evolution engine
relay/
  server.js            # WebSocket signaling relay (113 lines)
  package.json
  Dockerfile
```

### P2P module (`p2p.js`)

```js
const p2p = new P2PMesh({
  defaultRoom: 'my-room',
  genomeSize: 22,
  onEliteReceived: (genome, fitness, from) => { /* inject */ },
  onStatusChange: (status) => { /* update UI */ },
  onLog: (msg, cls) => { /* log */ },
});
p2p.connect();
p2p.broadcastElite(genome, fitness);
```

- WebRTC data channels for direct peer-to-peer genome transfer
- WebSocket relay fallback when WebRTC can't connect (corporate firewalls, Docker NAT)
- Binary protocol: `Float32Array[fitness, ...genome]` over data channels
- Per-peer rate limiting (500ms), genome size validation, NaN/Infinity rejection
- Max 20 peers per node, 50 per relay room

### Relay server (`relay/server.js`)

113 lines of Node.js. Routes WebRTC signaling messages (offers, answers, ICE candidates) and provides a WebSocket fallback for genome relay when data channels can't be established.

**Limits:** 64KB max message, 20 msg/s rate limit, 50 peers/room, 100 rooms max.

**Deploy:** Railway, Fly.io, Render, or any platform that supports WebSocket.

```bash
cd relay && npm install && node server.js
# Health check: curl http://localhost:8082/health
```

## Run locally

```bash
# Serve demos on any static server
npx serve demos

# Or with Python
cd demos && python3 -m http.server 8080
```

Open `http://localhost:8080/flappy.html` in Chrome 120+. Open a second tab to test P2P.

## Requirements

- Chrome 120+, Firefox 139+, or Safari 18+ (WebGPU support)
- Any GPU (Apple Silicon, NVIDIA, AMD, Intel, Qualcomm -- all work)

## Security

- **Private rooms by default.** Each "Connect P2P" click generates a random room code. No strangers mix unless you share the link or click "Join Public Room."
- **Genome validation.** Incoming genomes are checked for exact size, NaN, Infinity, and fitness bounds before injection.
- **Rate limiting.** Per-peer (500ms) and per-connection (20 msg/s) limits prevent flooding.
- **No data on server.** The relay only routes signaling messages. Genome data flows directly between browsers via WebRTC. The relay fallback forwards genomes only when data channels fail.

## Related

- [kernelfusion.dev](https://kernelfusion.dev) -- Research hub
- [gpubench.dev](https://gpubench.dev) -- GPU benchmarks (487 devices tested)
- [@webgpu-fusion/core](https://www.npmjs.com/package/@webgpu-fusion/core) -- Fused transformer SDK
- [Paper 1: Kernel Fusion for Sequential Fitness Evaluation](https://doi.org/10.5281/zenodo.19343570)
- [Paper 2: Kernel Fusion for Transformer Decoding](https://doi.org/10.5281/zenodo.19344277)

## License

MIT
