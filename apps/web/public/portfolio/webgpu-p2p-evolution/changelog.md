# Changelog

All notable changes to this project will be documented in this file. The
format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows [Semantic Versioning](https://semver.org/) starting
from `0.1.0`.

## [0.1.0] — 2026-05-04

First public release. **Peer-to-peer evolutionary computation running
entirely in the browser.** WebGPU compute shaders for GPU-native
evaluation, WebRTC data channels for direct genome exchange between
tabs / devices. No server, no install, no CUDA.

### Live demos

| Demo                                              | What it does                                   | GPU workload                              | P2P payload         |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- | ------------------- |
| [Flappy Evolution](demos/flappy.html)             | Neural networks learn Flappy Bird              | 4,096 birds / dispatch, 22-weight NN      | 22 floats (88 B)    |
| [Rastrigin P2P](demos/rastrigin-p2p.html)         | 2,000-dim multimodal optimization              | 4,096 candidates                          | 2,000 floats (8 KB) |
| [PETase Enzyme](demos/petase-p2p.html)            | Plastic-degrading enzyme design                | 4,096 protein variants, 65 positions      | 65 floats (260 B)   |
| [Neoantigen MHC-I](demos/neoantigen-p2p.html)     | Cancer-vaccine peptide evolution               | 4,096 peptides, 9-mer across HLA alleles  | 9 floats (36 B)     |

Live at [gpubench.dev/demos](https://gpubench.dev/demos).

### Added

- **Single fused WebGPU compute shader per demo** — evaluate, select,
  mutate in one dispatch (4,096-individual island per browser tab).
- **WebRTC island model** — open multiple tabs, share a private room
  code, and genomes flow directly browser-to-browser via data channels.
- **113-line WebSocket relay** (`relay/server.js`) for STUN-style
  signalling — only handshake metadata, never genome data.
- **Four problem domains shipped**: classic optimization (Rastrigin),
  RL (Flappy), protein design (PETase), and immunotherapy
  (neoantigen / MHC-I).

### Companion projects

- [gpubench.dev](https://gpubench.dev) — public WebGPU benchmark hub
  hosting these demos.
- [webgpu-kernel-fusion](https://github.com/abgnydn/webgpu-kernel-fusion)
  — research umbrella on single-kernel fusion.

[0.1.0]: https://github.com/abgnydn/webgpu-p2p-evolution/releases/tag/v0.1.0
