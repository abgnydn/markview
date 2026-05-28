# kernelfusion.dev

Research umbrella for GPU kernel fusion — eliminating per-dispatch overhead across evolutionary computation and transformer inference.

**Live:** [kernelfusion.dev](https://kernelfusion.dev)

## Research

### Paper 1: Sequential Fitness Evaluation (v6, published)
- **159-720×** over PyTorch on the same GPU
- Confirmed across CUDA, WebGPU, JAX/XLA, Triton
- 92 unique devices across 7 GPU vendors via [gpubench.dev](https://gpubench.dev)
- [Preprint](https://doi.org/10.5281/zenodo.19331833) · [Code](https://github.com/abgnydn/webgpu-kernel-fusion)

### Paper 2: Transformer Decoding (v2, published)
- **66-458×** parallel fused vs unfused dispatch (M2 Pro)
- **6.6-13.5×** single-threaded fused
- Cross-vendor median (gpubench.dev): 71× Apple, 56× NVIDIA, 20× Qualcomm
- [Preprint](https://doi.org/10.5281/zenodo.19344276) · [Code](https://github.com/abgnydn/webgpu-transformer-fusion)

## Author

Ahmet Baris Gunaydin — Independent Researcher

## License

MIT
