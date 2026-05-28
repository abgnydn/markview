# swarm-bio

Browser-based protein sequence evolution using WebGPU compute shaders. Runs evolutionary optimization of protein sequences against proxy fitness functions entirely on the GPU, in a browser tab.

**No wet-lab validation has been performed.** All results are computationally predicted. The fitness functions encode known biology (e.g., catalytic triad positioning, PSSM-derived anchor residues); the optimizer converges on these priors rather than discovering them independently.

## Workloads

**PETase variants** -- Evolves 65 mutable positions of a ~290-residue PET-degrading enzyme against a proxy fitness function combining predicted stability and catalytic activity.

**MHC-I neoantigen peptides** -- Evolves 9-mer peptides scored for MHC-I binding using position-specific scoring matrices derived from known anchor residue preferences.

**Antimicrobial peptides (AMPs)** -- Evolves short peptide sequences scored on net charge, amphipathicity, and helix propensity.

## Performance

Tested on Mac M2 Pro and iPhone 14 Pro Max over LAN.

| Device | PETase throughput |
|--------|-------------------|
| Mac M2 Pro (Chrome) | ~1,500 generations/s |
| iPhone 14 Pro Max (Safari) | ~200 generations/s |

## Repository structure

```
src/        WebGPU engines and compute shaders
demos/      Browser demos (standalone HTML)
analysis/   Peptide scoring and validation scripts
tests/      Test runners (Puppeteer + Chrome)
lan/        LAN server for multi-device testing
```

## Running

Open any file in `demos/` in Chrome (requires WebGPU support).

For multi-device testing:

```
node lan/serve_lan.js
```

Then open the served URL from other devices on the same network.

## Tests

Tests use Puppeteer with a local Chrome instance. See `tests/` for details.

## Limitations

- Fitness functions are proxies encoding known biological priors, not learned models.
- ESMFold structure predictions used in analysis are computational, not experimentally determined.
- No sequences from this tool have been synthesized or assayed.
- Convergence on known motifs reflects the fitness function design, not independent discovery.

## License

See [LICENSE](LICENSE).
