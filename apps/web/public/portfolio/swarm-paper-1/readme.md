# Single-Kernel Fusion for Sequential Fitness Evaluation via WebGPU Compute Shaders

**Paper:** [paper/PAPER.md](paper/PAPER.md)

## Key Finding

Fusing sequential fitness evaluations into single GPU compute shader dispatches achieves **159x throughput** over PyTorch's per-step dispatch on identical hardware (Apple M2 Pro). On embarrassingly parallel workloads, WebGPU matches PyTorch MPS (1.06x). A native Metal baseline via wgpu-native quantifies Chrome's browser sandbox overhead at **1.92x (48%)** — yet WebGPU in a browser tab still **outperforms PyTorch MPS** running natively (170.3 vs 160.5 gen/s).

## Reproducing Results

### Prerequisites

- Chrome 120+ (WebGPU enabled by default)
- Node.js 18+ with npm
- Python 3.10+ with pip
- Apple M2 Pro or compatible GPU (results will differ on other hardware)

### Setup

```bash
# JavaScript benchmarks (WebGPU via Puppeteer)
npm install

# Python baselines
pip install -r benchmarks/requirements.txt
```

### Reproducing Each Table

| Table | Command | What it measures |
|-------|---------|-----------------|
| Table 1 | `npm run bench:rastrigin` | Rastrigin throughput (POP=4096, DIM=2000) + native Metal baseline |
| Table 2 | `npm run bench` | Financial simulation throughput (POP=10000, 1500 steps) |
| Table 3 | `npm run bench:pytorch` | torch.compile scaling with sequential timesteps |
| Table 4a | `npm run bench:cmaes` | CMA-ES vs WebGPU across dimensions |
| Tables 4-6 | `npm run bench:comprehensive` | Population, benchmark suite, genome scaling |
| Thermal | `npm run bench:thermal` | GPU utilization and thermal profile |

### Python Baselines

```bash
python3 benchmarks/numpy_variance.py      # NumPy (N=10)
python3 benchmarks/pytorch_variance.py     # PyTorch MPS (N=10)
python3 benchmarks/jax_variance.py         # JAX CPU (N=10)
python3 benchmarks/cmaes_benchmark.py      # CMA-ES (N=30)
```

## Repository Structure

```
src/
  nn_core.wgsl          # Shared RNN forward pass (~246 params)
  swarm_shader.wgsl     # Evaluate + evolve entry points
benchmarks/
  bench.js              # Main Puppeteer benchmark runner
  comprehensive_benchmarks.js  # Population/dimension scaling
  dim_scaling_benchmark.js     # Dimension scaling sweep
  cmaes_benchmark.py    # CMA-ES comparison (Python)
  pytorch_gpu_baseline.py      # PyTorch MPS baseline
  jax_baseline.py       # JAX CPU baseline
  rastrigin_baseline.py # NumPy baseline
  *_variance.py         # Variance measurement scripts (N=10)
  thermal_monitor.js    # GPU utilization monitoring
  results/              # Raw benchmark output
paper/
  PAPER.md              # The paper
```

## Hardware

All primary results: Apple M2 Pro (19-core GPU, 16 GB unified memory), Chrome 123, macOS 14 (Sonoma).

## Citation

```bibtex
@article{gunaydin2026kernelfusion,
  title={Single-Kernel Fusion for Sequential Fitness Evaluation via WebGPU Compute Shaders},
  author={Gunaydin, Ahmet Baris},
  year={2026}
}
```

## License

MIT
