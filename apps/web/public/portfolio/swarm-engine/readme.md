# swarm-engine

Browser-native distributed neuroevolution via WebGPU compute shaders.

Evolves populations of neural networks entirely on the GPU using ~360 lines of WGSL. Multiple browser tabs or devices form a P2P mesh via WebRTC to exchange elite genomes. No install, no drivers, no cloud.

**Paper:** [Browser-Native Distributed Neuroevolution via WebGPU Compute Shaders](paper/PAPER.md)

## Key results

| Benchmark | Result |
|---|---|
| Rastrigin (POP=4096, DIM=2000) | 170 gen/s — matches PyTorch MPS (0.98x) |
| Financial simulation (POP=10000, 1500 timesteps) | 46 gen/s — 159x over PyTorch |
| CartPole-v1 | Solved in ~40ms |
| P2P island model (4 tabs, shared GPU) | 28.8% fitness improvement |
| Cross-platform (RTX 3090, Vulkan) | 14.6% fitness improvement across 4 nodes |

Hardware: Apple M2 Pro (Metal), NVIDIA RTX 3090 (Vulkan). Chrome 120+.

## Quick start

**Run a demo:**

```bash
# Serve demos locally (any static server works)
npx serve demos
# Open http://localhost:3000 in Chrome
```

**Run the P2P swarm:**

```bash
# Start signaling relay
npm run relay

# Open demos/p2p_demo.html in multiple tabs
# Click "Connect P2P" in each tab
```

Or use the deployed relay at `wss://swarm-relay-fbyx.onrender.com`.

## Tests

```bash
# Unit tests (805 correctness + 117 security)
npm test

# GPU parity test (Puppeteer + WebGPU, 14 cases)
npm run test:gpu

# E2E paper claims verification (Puppeteer, 19 tests)
npm run test:e2e

# All tests
npm run test:all
```

## Benchmarks

```bash
# Full benchmark suite (Puppeteer + WebGPU)
npm run bench

# Python baselines
python3 benchmarks/rastrigin_baseline.py
python3 benchmarks/pytorch_gpu_baseline.py
python3 benchmarks/jax_baseline.py
```

Benchmark results are saved to `benchmarks/results/`.

## Repository structure

```
src/
  nn_core.wgsl          Shared RNN forward pass (8->16->6, 246 params)
  swarm_shader.wgsl      Evaluate + evolve kernels (tournament, crossover, mutation)
  engine.js              Rastrigin WebGPU worker (P2P demo engine)
  p2p.js                 WebRTC P2P genome exchange with validation
  signaling.js           WebSocket signaling client

demos/
  index.html             Demo hub — links to all demos with paper sections
  trading.html           Financial neuroevolution (Sections 2-3)
  cartpole.html          CartPole-v1 control benchmark (Section 4.5)
  p2p_demo.html          P2P Rastrigin benchmark (Section 4.4)
  friction_sweep.html    Friction phase transition (Section 5)
  gpu_parity_test.html   GPU vs CPU numerical parity (Section 4.1)
  paper_trade.html       Live paper trading with SSoT inference

benchmarks/
  bench.js               Puppeteer benchmark harness (all paper tables)
  comprehensive_benchmarks.js   Population/dimension/multi-tab scaling
  pytorch_gpu_baseline.py       PyTorch MPS baseline
  jax_baseline.py               JAX CPU baseline
  rastrigin_baseline.py         NumPy CPU baseline

tests/
  verify_correctness.js         805 unit tests (nn_forward, fitness, invariants)
  test_security.js              117 security tests (validation, rate limits, escaping)
  test_gpu_parity.js            GPU vs CPU parity via Puppeteer (14 cases)
  test_e2e_puppeteer.js         E2E paper claims verification (19 tests)
  nn_reference.js               JavaScript reference implementation

relay/
  server.js              WebSocket signaling relay
  Dockerfile             Container deployment
  fly.toml               Fly.io config

paper/
  PAPER.md               Full paper with 25 references
```

## Browser support

- Chrome 120+ (WebGPU enabled by default)
- Safari 18+ (WebGPU)
- Edge 120+

Works on Apple Metal, NVIDIA Vulkan, AMD Vulkan, Intel D3D12 via Chrome's translation layer.

## License

MIT
