# machine-engineer

Working directory for the **machine-engineer collab** — a two-person venture between Baris (WebGPU / kernel-fusion / simulation) and a mechanical-engineer co-founder based in Bolu, Turkey.

## Thesis (one line)

A mechanical engineer who understands real-world physics + a GPU engineer who can fuse 11-stage pipelines into a single dispatch is an unusually well-matched pair for **simulation / CAE / digital-twin software sold globally from a Turkey base**.

## The technical anchor we already own

- [`wgpu-adas-bench`](https://github.com/abgnydn/wgpu-adas-bench) — 11-stage radar + camera sensor-fusion pipeline, **780 fps at R=256,C=50,T=128 on M2 Pro (11.9× PyTorch)**; 15.3× at heavier config. `~/wgpu-adas-bench` locally.
- [`wgpu-native-bench`](https://github.com/abgnydn/wgpu-native-bench), [`gpubench.dev`](https://gpubench.dev), [`kernelfusion.dev`](https://kernelfusion.dev) — the kernel-fusion research program, with two preprints and 487 real-device measurements.
- [`zero-tvm`](https://zerotvm.com), [`fused-lora`](https://github.com/abgnydn/fused-lora), [`neuropulse`](https://neuropulse.zerotvm.com), [`swarm-engine`](https://github.com/abgnydn/swarm-engine) — the broader browser-native ML + distributed-evolution stack.

What this means in practice: **any commercial wedge we pick gets a 10–100× speedup moat on day one** as long as the workload is pipeline-deep enough to benefit from fusion. The mech-eng partner owns the domain modelling; the GPU side is already 60–80% done.

## Files in this directory

| File | Purpose |
|---|---|
| `README.md` | This map. |
| `STRATEGY.md` | Ranked 2026 opportunity wedges + top-3 "start Monday" actions. Populated from deep research on Turkish market + global CAE/simulation/AI landscape. |
| `ONBOARDING.md` | First-2-week plan for the mech-eng co-founder. Designed to respect existing expertise — not a "learn to code" track. |

## Related vault entries

- `~/brain/projects/wgpu-adas-bench.md` — the technical anchor page.
- `~/brain/projects/kernelfusion.md` — the research umbrella.
- `~/brain/.brain/UPDATES.md` — the vault update-protocol checklist (created during this kickoff).
- `~/brain/daily/2026-04-24.md` — session journal.
