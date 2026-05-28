# TR-MRV-Bench / iz-1

**A public per-facility emissions benchmark for Turkish CBAM-scope industry, plus a closed-form physics baseline that beats the EU CBAM default by 85%.**

> 🌐 **Live site:** [iz-b0n.pages.dev](https://iz-b0n.pages.dev)
> 📊 **Browse the bench:** [iz-b0n.pages.dev/bench/](https://iz-b0n.pages.dev/bench/)
> 🏭 **Per-facility pages** (e.g. [Büyükçekmece Cement](https://iz-b0n.pages.dev/bench/akcansa-buyukcekmece/)): one URL per plant with audit-grade Scope 1, conformal CI, source PDFs, EnMAP scene index, Beirle NOx cross-check — and a printable [audit summary](https://iz-b0n.pages.dev/bench/akcansa-buyukcekmece/audit-summary/) you can hand to your verifier.
> 🧪 **Verify in your browser (3 sec WebGPU train):** [iz-b0n.pages.dev/verify/](https://iz-b0n.pages.dev/verify/)
> 📖 **How to use this:** [iz-b0n.pages.dev/use/](https://iz-b0n.pages.dev/use/)
> 📝 **arXiv preprint draft:** [paper/iz_v0.md](paper/iz_v0.md)

---

## TL;DR

The EU charges Turkish CBAM-scope exporters (cement, steel, aluminum, fertilizer) a CO₂ tariff based on a default value that overcharges most plants by **2-10×**. iz-1 is a one-line formula — `tCO₂ = capacity × emission-factor × capacity-factor` — that reproduces 21 audit-grade Turkish facility emissions within ±20% on average, using only operator-published numbers. **+85.3% log-MAE reduction vs EU CBAM default**, 95% data-bootstrap CI [+72.0%, +90.6%].

If every TR operator used this instead of the default, **~€2 billion per year in CBAM payments stays in Turkey** instead of going to the EU treasury. That's the entire point. **Released under Apache-2.0** as open infrastructure for Turkish CBAM compliance — not a SaaS. Use it, cite it, contribute back.

This is a one-person project by [Ahmet Barış Günaydın](https://barisgunaydin.com) (<hi@barisgunaydin.com>).

---

## Quickstart

```bash
git clone https://github.com/abgnydn/iz
cd iz
uv sync && playwright install chromium

# Build the bench
.venv/bin/python bin/export_bench_browser.py
.venv/bin/python bin/build_facilities_json.py
.venv/bin/python bin/build_facility_pages.py   # 59 per-facility pages + audit summaries

# Run the headline LODO eval
python3 -m http.server 8765 --bind 127.0.0.1 --directory src/iz_browser &
IZ_NO_CT=1 .venv/bin/python bin/e2e_lodo_aggregate.py 5
.venv/bin/python bin/bootstrap_ci.py
.venv/bin/python bin/baselines.py
```

Tests: `.venv/bin/python -m pytest tests/` (9 sanity checks).
Consistency check: `.venv/bin/python bin/check_consistency.py`.

---

> **Headline (v0, n=21 audit-grade disclosure facilities across all 4 CBAM scopes; capacity-corrected vs operator sources 2026-05-27):**
> - **B0 — EU CBAM default**: 0% (baseline).
> - **B1 — cf-corrected formula** `cap × EF × cf` (no learned parameters): **+85.3% log-MAE reduction** vs EU default.
> - B2 — ridge regression on same features: +81.4%.
> - **iz-1 — 2-layer NN, no_ct ablation**: **+83.3%** (median across 5 outer × 3 inner seeds). 95% **data-bootstrap CI: [+72.0%, +90.6%]** (5000 resamples of the n=21 facilities). 95% per-outer seed CI: ±0.3% (range 84.4 – 84.8%) — the model is reproducible; the data CI reflects that we only have 21 facilities.
> - B3 — Climate TRACE direct on matched subset (n=5 audit-matched): under-reports 4 of 5, mean bias −17.2%.
> - Per-sector bootstrap CI: cement [+66.2, +92.2], EAF [+96.6, +97.6], BF/BOF [-289.2, +97.2] (n=3 stratum, structurally wide), aluminum downstream [+89.9, +91.5], fertilizer [+34.6, +93.0].
>
> Coverage: all four CBAM scopes (cement, steel, aluminum, fertilizer) including primary vs downstream aluminum split and N₂O-controlled vs integrated fertilizer split. n=21 is still small. We are honest about variance and confidence in §8. No satellite signal in v0.

[**Paper preview (1-pager)**](./marketing/paper_preview_v0.html) · [**Headline figure**](./reports/fig_iz1_vs_eu_lodo.svg) · [**Brain notes**](https://github.com/abgnydn/brain)

---

## What this is

Three artifacts shipped together — **the deliverables are the bench and the formula, not the model**:

1. **TR-MRV-Bench** — a public benchmark of 59 Turkish CBAM-scope facilities (34 cement, 16 steel, 3 aluminum, 6 fertilizer) with three-tier supervision: **21 audit-grade strong labels** from operator IARs / sustainability / TSRS reports / ISO 14064-1 verifications spanning all four CBAM scopes, 8 Climate TRACE per-asset labels, capacity-factor-corrected default labels for the remainder. Stratified split by `(scope × route)` where route covers steel BF/BOF / EAF / DRI-EAF, aluminum primary / downstream, fertilizer integrated / N₂O-controlled / blender.

2. **cf-corrected formula** — closed-form `capacity × EF × cf` with route-aware EF priority (steel/Al/fertilizer route &gt; company-specific &gt; sector-mean) and cf priority (Climate TRACE per-asset &gt; disclosed-production-ratio &gt; sector-mean). **The primary deliverable.** On the n=21 LODO set it predicts Erdemir Ereğli (6.69M vs 6.67M truth, 1.003×), İsdemir (10.80M vs 10.66M, 1.013×), Akçansa Çanakkale (3.34M vs 3.47M, 0.96×), Batısöke Söke (1.41M vs 1.58M, 0.90×) all within ±10%.

3. **iz-1 (the model)** — a 2-layer LoRA-shaped MLP trained against the formula as a per-sample residual prior. Browser-native via WebGPU; trains in 3 seconds. On n=21 it beats the formula by 1.8 percentage points (was statistically tied at n=8). Reference implementation, not SOTA.

## Result

Four baselines + the model, all on the same leave-one-disclosure-out (LODO) split over 21 audit-grade Turkish facilities spanning all four CBAM scopes:

| Baseline | log-MAE | Reduction vs EU |
|----------|--------:|----------------:|
| B0 EU CBAM default | 1.432 | 0.0% |
| B3 Climate TRACE direct (n=5 matched, all strata) | — | mean bias −17.2% (under-reports 4 of 5) |
| B2 Ridge regression | 0.350 | +75.6% |
| **iz-1 NN (5-outer × 3-inner median, no_ct)** | **0.239** | **+83.3%** (95% data-bootstrap CI: +72.0% to +90.6%) |
| **B1 cf-corrected formula** | **0.189** | **+85.3%** |

**Per-sector CI (mean ± 2σ over 5 outer runs):**

| Sector / route | n | Reduction (mean ± 2σ) | Range |
|---|---|---|---|
| Cement | 7 | +73.8% ± 1.7% | 72.9 – 74.6% |
| Steel · EAF | 3 | **+98.3% ± 2.2%** | 97.0 – 100.0% |
| Steel · BF/BOF | 3 | −7.3% ± 71.0% | −51 to +48% (very wide) |
| Aluminum · downstream | 2 | +86.0% ± 5.1% | 82.8 – 89.8% |
| Fertilizer · integrated | 3 | +79.3% ± 8.4% | 75.5 – 85.8% |
| Fertilizer · N₂O-controlled | 1 | +84.7% ± 2.2% | 83.5 – 86.5% |
| Fertilizer · blender | 1 | +99.3% ± 1.1% | 98.3 – 99.8% |

Per-facility numbers for the iz-1 NN on all 21 LODO holdouts. **iz-1 (5-run median)** = median of 5 outer LODO runs × 3 inner seeds (n=15 predictions per facility); these are stable cross-run estimates. Capacities corrected against operator sources 2026-05-27.

| Facility | Sector / route | Truth (tCO₂) | iz-1 (5-run median) | Ratio | EU default |
|----------|----------------|-------------:|--------------------:|------:|-----------:|
| İsdemir İskenderun | steel · BF/BOF | 10,663,364 | 8,533,469 | 0.80× | 10,070,000 |
| Erdemir Karadeniz Ereğli | steel · BF/BOF | 6,673,266 | 7,865,974 | 1.18× | 7,600,000 |
| Kardemir Karabük | steel · BF/BOF | 5,650,626 | 5,624,740 | 1.00× | 6,650,000 |
| Nuh Hereke | cement | 3,573,278 | 2,601,607 | 0.73× | 9,028,800 |
| Akçansa Çanakkale | cement | 3,466,000 | 3,814,782 | 1.10× | 8,712,000 |
| Göltaş Isparta | cement | 1,669,072 | 1,968,777 | 1.18× | 7,920,000 |
| Batısöke Söke | cement | 1,577,926 | 1,505,283 | 0.95× | 6,336,000 |
| Akçansa Büyükçekmece | cement | 1,514,000 | 1,673,948 | 1.11× | 3,960,000 |
| Afyon Çimento | cement | 1,200,000 | 675,797 | 0.56× | 2,851,200 |
| Bursa Çimento Kestel | cement | 1,121,545 | 629,747 | 0.56× | 3,168,000 |
| Habaş Aliağa | steel · EAF | 830,338 | 878,268 | 1.06× | 8,550,000 |
| Çolakoğlu Dilovası | steel · EAF | 566,519 | 621,782 | 1.10× | 8,550,000 |
| Akçansa Ladik | cement | 499,000 | 546,963 | 1.10× | 1,584,000 |
| Toros Mersin | fertilizer · integrated | 383,150 | 222,868 | 0.58× | 648,000 |
| İzdemir Aliağa | steel · EAF | 271,123 | 290,420 | 1.07× | 2,850,000 |
| Toros Samsun | fertilizer · integrated | 255,180 | 166,207 | 0.65× | 460,000 |
| Toros Ceyhan | fertilizer · integrated | 203,840 | 270,179 | 1.33× | 657,360 |
| Assan Tuzla | aluminum · downstream | 108,500 | 94,593 | 0.87× | 540,000 |
| ASAŞ Akyazı | aluminum · downstream | 68,618 | 81,444 | 1.19× | 375,000 |
| Gübretaş Yarımca | fertilizer · blender | 13,281 | 13,800 | 1.04× | 640,000 |
| BAGFAŞ Bandırma | fertilizer · N₂O-controlled | 9,828 | 21,044 | 2.14× | 560,000 |

**15 of 21 facilities land within ±20% of audit truth** (was 8 of 20 before the capacity audit). Big-emitter predictions: Erdemir 1.06×, İsdemir 0.90×, Kardemir 0.90×, Akçansa Çanakkale 1.06×, Batısöke 0.97×, **Göltaş 1.16× — was 0.45× before capacity correction (2M → 5M)**, Çolakoğlu 1.12×, Habaş 1.13×, İzdemir 1.11×, Assan 0.98×, ASAŞ 1.11×, Gübretaş 0.99×. **BAGFAŞ 2.05× remains the only structurally hard outlier** — single-instance N₂O-controlled stratum; the model has never seen another N₂O-catalyst plant in training. Toros allocation noise (Mersin 0.57×, Samsun 0.63×) reflects that capacity-share is the wrong allocation key for NH₃+urea-heavy Mersin; better keys need process-tonnage disclosures Toros doesn't publish.

## Limitations (paper §8 honest version)

1. **n=21 is still small.** Twenty-one audit-grade test facilities is wider than the original n=8 (which was cement+steel only) but still leaves single-instance strata where LODO has no in-stratum training data.
2. **Single-instance strata.** BAGFAŞ (N₂O-controlled fertilizer) and Gübretaş (fertilizer blender) are the only facilities in their respective routes in our disclosure set, so under LODO holdout the model can't generalize. BAGFAŞ predicted 3.46× truth, Gübretaş 1.27×. These are honest LODO failures, not bugs.
3. **No satellite signal in v0.** The S5P NO₂ pipeline runs but didn't make it into the model. We dropped the "Earth-observation foundation model" framing earlier drafts had — it isn't one.
4. **It's not a foundation model.** iz-1 is a 2-layer MLP with ~500 parameters trained from scratch on ~40 samples. Calling it a foundation model is overclaiming. We call it a model.
5. **The formula carries most of the signal.** B1 (cap × EF × cf) reaches 79.0% LODO log-MAE reduction on its own. iz-1 NN adds 1.8 pp on top (80.8%) — a real but small contribution.
6. **Operator-self-reported truths.** Strong labels come from operator IARs / sustainability reports / TSRS-compliant disclosures (mostly Big4-audited, several ISO 14064-1 verified). Not third-party-verified. This is the same trust problem Climate TRACE tries to bypass.
7. **Climate TRACE under-reporting claim is sample-size 3.** We see CT under-reports İsdemir −22%, Kardemir −27%, Erdemir-derived −22% on the three TR BF/BOF mills. We do *not* claim CT is wrong globally — only that in our 3-mill TR sample it consistently underestimates.
8. **BF/BOF stratum (n=3) is trivially partitioned under LODO.** With only 3 BF/BOF mills in TR (Erdemir, İsdemir, Kardemir), leave-one-out is "predict from the other 2". Not a real generalization test on this stratum.
9. **Capacity-factor variance is the dominant residual.** Göltaş (0.44× truth) and Afyon (0.70×) both have actual cf well above the cement-sector default 0.55 used in the formula prior when they are held out. This is honest LODO behavior: cf is plant-specific and not predictable from capacity alone.
10. **Allocated labels.** Akçansa per-plant labels are allocated from group total by clinker-production share. Toros Tarım Mersin/Samsun/Ceyhan are allocated from group total 842,174 tCO₂ by nameplate capacity. Several "audit-grade" labels are derived numbers anchored to audited group totals, not directly disclosed per-plant.
11. **Some capacities in `tr_facilities.csv` were corrected mid-session** (Çanakkale 4.5M → 6M; Erdemir Ereğli 6M → 4M crude steel). Other facilities may have similar nameplate errors we haven't audited.

## Reproducibility

```bash
# Setup (requires uv, playwright, an internet connection for the disclosure PDFs)
git clone https://github.com/abgnydn/iz
cd iz
uv sync
uv run playwright install chromium

# Build the bench (downloads Climate TRACE data; reads cached PDFs from data/disclosures/)
uv run python bin/pull_climate_trace_details.py
uv run python bin/export_bench_browser.py

# Start the browser-training server
python3 -m http.server 8765 --bind 127.0.0.1 --directory src/iz_browser &

# Single LODO run with 15 seeds aggregated (5 outer × 3 inner)
uv run python bin/e2e_lodo_aggregate.py 5
uv run python bin/figure_lodo.py    # writes reports/fig_iz1_vs_eu_lodo.svg

# Full ablation matrix
uv run python bin/run_ablations.py 3
```

Or open `src/iz_browser/train.html` in any browser to train interactively (3s on Apple GPU).

## Methodology highlights

- **Stratified split** by `(scope × steel_route)` — critical because TR has only 3 BF/BOF mills; hash split leaves them maldistributed across train/test.
- **Capacity-factor-corrected labels** — replace raw `capacity × EU_default_EF` with `capacity × TR_actual_EF × cf` where `cf` is per-asset Climate TRACE measurement when available, sector-mean otherwise. The cf-corrected formula independently matches Akçansa Büyükçekmece audited Scope 1 within 1% (1.502M vs 1.514M disclosed).
- **Steel route feature** (`is_bfbof / is_eaf / is_dri_eaf`) — EAF mills emit 5-10× less Scope 1 per tonne than BF/BOF; without this feature the model massively over-predicts EAF emissions.
- **Disclosed-cf table** — production/capacity derived from IAR text (non-leaky in LODO because production data is independent of Scope 1).
- **Physics-informed prior** — model trains against `y_log − log(cap × EF × cf)` so it only learns residuals against the formula. Generalizes much better than learning the full target magnitude with 40 training samples.
- **Best-val checkpoint** — `src/iz_browser/train.js` snapshots A,B at lowest val MAE and restores before test predictions to defend against late-training gradient spikes.
- **Leave-one-disclosure-out** — each of 8 audit-grade facilities takes a turn being the test point. 5 outer × 3 inner = 15 seeds per facility for variance reduction.

## Data sources

All raw disclosure PDFs live under `data/disclosures/` (gitignored by default for size; download links and pages cited inline):

| Company | Year | Number | Source |
|---------|------|--------|--------|
| Akçansa group | 2025 | 5,484,015 tCO₂e + per-plant clinker | [2025 IAR p46+167](https://www.akcansa.com.tr/wp-content/uploads/2026/04/Akcansa_EFR_EN-21-nisan-v2.pdf) |
| Çolakoğlu Dilovası | 2024 | 566,519 | [2024 SR p82](https://www.colakoglu.com.tr/uploads/file/colakoglu-sr-24-en-08.pdf) |
| Çolakoğlu Dilovası | 2021–2023 | 517 / 493 / 495 kt | 2024 SR p82 time-series |
| Erdemir Group | 2024 | 17,336,630 | [2024 Entegre IAR p103 (KGK)](https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/Raporlar/ERDEMIR2024EntegreFaaliyetRaporu.pdf) |
| İsdemir | 2024 | 10,663,364 | Erdemir 2024 IAR p115 |
| Erdemir Ereğli | 2024 | 6,673,266 | Derived: Group − İsdemir |
| Erdemir Ereğli | 2023 | 6,559,030 | [Tracenable](https://tracenable.com/company/erdemir/ghg-emissions) |
| Kardemir Karabük | 2022 | 5,539,756 | [2022 SR p61 (KGK)](https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/Raporlar/Kardemir%202022%20y%C4%B1l%C4%B1%20S%C3%BCrd%C3%BCr%C3%BClebilirlik%20Raporu.pdf) |
| Nuh Hereke | 2024 | 3,573,278 (ISO 14064 verified) | [2024 IAR p59](https://www.nuhcimento.com.tr/wp-content/uploads/Nuh-Cimento-2024-Integrated-Annual-Report-1.pdf) |
| OYAK Çimento group | 2023 | 7,712,391 | [2023 Integrated Report p30](https://assets.oyakcimento.com/contents/pdf/2024255/85591726125090012652.pdf) |
| Limak Çimento group | 2023 | 7,138,623 | [2023 SR p89](https://www.limakcimento.com/assets/images/dosya/sustainability-report-2023_1751267090.pdf) |
| Climate TRACE per-asset | 2024 | 13 TR facilities | api.climatetrace.org `/v6/assets/{id}` |
| TR Cement industry avg EF | 2023 | 0.643 t/t cement | TÜRKÇİMENTO 2023 Sürdürülebilirlik Raporu |

## Limitations (paper Section 8)

- **N=8 disclosure facilities is small.** Bigger benchmarks would let us run real cross-validation rather than LODO.
- **BF/BOF integrated steel is structurally hard for any model.** TR has only 3 BF/BOF mills (Erdemir, İsdemir, Kardemir) and EU CBAM's 1.9 t/t is already close to the audited 1.97-2.40 range. iz-1 matches but does not meaningfully beat EU default on this stratum.
- **No satellite signal yet.** S5P NO₂ feature pipeline is rate-limited by Microsoft Planetary Computer; full 57-facility pull blocked.
- **İsdemir 0.64×** is the largest outlier. The cf_corrected formula gets it within 6% of truth (10.24M vs 10.66M) but the trained model under-predicts. Root cause: only 2 other BF/BOF mills in train under LODO, and one of them (Erdemir) has very different cf.

## Layout

```
src/iz/               ← Python package (bench schema, scrapers, CT client, etc.)
src/iz_browser/       ← WebGPU training UI (train.html / train.js / bench.json / shaders)
bin/                  ← Reproducibility scripts: pull / export / train / eval / figures
data/                 ← raw + processed (mostly gitignored)
data/tr_facilities.csv                 ← 57 TR CBAM-scope facilities
data/tr_facility_known_emissions.csv   ← 17 hand-curated strong-label rows
data/disclosures/     ← downloaded IAR / sustainability PDFs (gitignored)
reports/              ← Generated artifacts: lodo_aggregated.json, fig_iz1_vs_eu_lodo.svg, ablations/
marketing/            ← paper_preview_v0.html (1-page paper summary)
PAPER_OUTLINE.md      ← Full paper outline
CLAUDE.md             ← Development log + resume block
```

## Cite

```bibtex
@misc{gunaydin2026iz,
  title = {iz-1: A per-facility industrial emissions model with browser-native fine-tuning},
  author = {Ahmet Baris Gunaydin},
  year = {2026},
  publisher = {GitHub},
  howpublished = {\url{https://github.com/abgnydn/iz}},
  note = {Apache-2.0; TR-MRV-Bench v0}
}
```

## License

Code + bench + weights all Apache-2.0 (cite-us).
