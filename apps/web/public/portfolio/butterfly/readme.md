# Butterfly

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20505472.svg)](https://doi.org/10.5281/zenodo.20505472)

**A small-LLM context-compaction mechanism is a *content-shape adapter*, not a universal context manager.**

Butterfly is a falsification study of a tag-and-rebuild context-compaction
loop for small language models. Tag every message in a conversation
`keep` / `summarize` / `melt`, rebuild the survivors (the "chrysalis") into a
tight token budget, inject fresh off-topic noise, repeat across generations.
The advertised claim: this preserves load-bearing facts better than naive
`lastN` truncation under compounding noise.

We pre-registered that claim, **refuted our own first pre-registration**, filed
a second regime that **confirmed**, then hardened the result by swapping the
tagger four ways. The fully hardened finding:

> Butterfly's tag-and-rebuild loop beats `lastN` at tight budgets under noise
> compounding **only when the tagger's prior matches the load-bearing-content
> distribution in the transcripts being compacted.** The mechanism is real but
> it's a content-shape adapter — **the engineering problem is the tagger, not
> the rebuild step.** Generic "find what's important" prompts on frontier
> instruction-tuned LLMs do not reliably replicate it; a small classifier
> trained on labeled examples of your domain's load-bearing shapes does.

The directional finding was reproduced against the external **LongMemEval**
benchmark (s and m) across three orders of magnitude of context size, plus a
cross-domain test.

**The full investigation — what we filed, what broke, what we'd file next — is
in [`PAPER.md`](PAPER.md). A formatted manuscript is at
[`paper/butterfly-manuscript.pdf`](paper/butterfly-manuscript.pdf).**

## Provenance

This work ran inside the **[neuropulse](https://github.com/abgnydn/neuropulse)**
browser visualizer, where the original in-app demo (`src/butterfly-mode.ts`)
and the git-timestamped pre-registrations live
([`PREDICTIONS.md`](https://github.com/abgnydn/neuropulse/blob/main/PREDICTIONS.md),
entries `P-20260512-05` and `P-20260515-06`). This repository is the canonical
home for the compaction harness and findings; neuropulse is the platform.

## Layout

- **Origin harness (April):** `experiment.mjs`, `transgen.mjs`, `hybrid.mjs`,
  `aggregate.mjs`, `transcript.mjs`, `claude-bridge.mjs`, `paper-test.mjs`,
  `rejudge.mjs` — the first rig (LM Studio / Anthropic bridge), pure Node.
- **Extensions (May):** `butterfly-purecode-hard.mjs` (the regime that
  confirmed), `butterfly-sweep-phasediagram.mjs` (the 960-cell boundary sweep),
  `butterfly-llm-tagger.mjs` (LLM / trained / embed taggers, one pipeline),
  `butterfly-train-classifier.mjs` + `butterfly-train-embed.mjs` (the learned
  taggers), `butterfly-adversarial.mjs` (the prose-needle transcripts that
  break every tagger), `butterfly-longmemeval.mjs` + `butterfly-crossdomain.mjs`
  (external-benchmark validation), `butterfly-qa-eval.mjs` /
  `butterfly-qa-rejudge.mjs` (QA scoring).
- Trained tagger weights: `butterfly-classifier-weights.json`,
  `butterfly-embed-weights.json`, `butterfly-longmem-weights.json`.

Everything is pure JS with no build step. The embedding cache
(`butterfly-embed-cache.json`) is gitignored and regenerated on first run.

## Cite

DOI: [10.5281/zenodo.20505472](https://doi.org/10.5281/zenodo.20505472) (concept — resolves to the latest version).

```bibtex
@software{gunaydin_butterfly_2026,
  author  = {Günaydın, Ahmet Barış},
  title   = {Butterfly: A Small-LLM Context-Compaction Mechanism is a
             Content-Shape Adapter, Not a Universal Context Manager},
  year    = {2026},
  doi     = {10.5281/zenodo.20505472},
  url     = {https://doi.org/10.5281/zenodo.20505472}
}
```

## License

MIT — see [`LICENSE`](LICENSE). Original code.
