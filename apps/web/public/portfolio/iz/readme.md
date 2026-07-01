# TR-MRV-Bench / iz

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20496086.svg)](https://doi.org/10.5281/zenodo.20496086)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/abgnydn/iz/blob/master/LICENSE)
[![Live site](https://img.shields.io/badge/live-iz--b0n.pages.dev-2d5a4c.svg)](https://iz-b0n.pages.dev)

**A public per-facility emissions benchmark for Turkish CBAM-scope industry, plus a closed-form physics baseline that beats the EU CBAM default by +82.3% (honest, leave-one-plant-out, n=19).**

> 🌐 **Live site:** [iz-b0n.pages.dev](https://iz-b0n.pages.dev)
> 📊 **Browse the bench:** [iz-b0n.pages.dev/bench/](https://iz-b0n.pages.dev/bench/)
> 🏭 **Per-facility pages** (e.g. [Büyükçekmece Cement](https://iz-b0n.pages.dev/bench/akcansa-buyukcekmece/)): one URL per plant with audit-grade Scope 1, conformal CI, source PDFs, EnMAP scene index, Beirle NOx cross-check — and a printable [audit summary](https://iz-b0n.pages.dev/bench/akcansa-buyukcekmece/audit-summary/) you can hand to your verifier.
> 🧪 **Reproduce the result yourself (pure Python):** [iz-b0n.pages.dev/verify/](https://iz-b0n.pages.dev/verify/)
> 📖 **How to use this:** [iz-b0n.pages.dev/use/](https://iz-b0n.pages.dev/use/)
> 📝 **Cite this:** [Zenodo DOI 10.5281/zenodo.20496086](https://doi.org/10.5281/zenodo.20496086)

---

## TL;DR

The EU charges Turkish CBAM-scope exporters (cement, steel, aluminum, fertilizer) a CO₂ tariff based on a default value that overcharges most plants by **2-10×**. **TR-MRV-Bench** is a public 59-facility benchmark of Turkish CBAM-scope industry, with audit-grade Scope 1 labels for 21 of them. The headline deliverable is the **cf-corrected formula** — `tCO₂ = capacity × emission-factor × capacity-factor` — computed from operator-published numbers only.

**The honest headline: +82.3% log-MAE reduction vs the EU CBAM default**, measured **leave-one-plant-out** (each plant's emission-factor is derived only from the *other* audit-grade plants, so no plant sees its own answer), over the **19 of 21** facilities that have at least one other plant in their route. The remaining **2 facilities — BAGFAŞ (N₂O-controlled) and Gübretaş (blender) — are the only plant of their type in the dataset, so they cannot be independently validated and are excluded from the headline** (shown for illustration only; see Limitations). The in-sample number (EF fitted on all plants, the way earlier drafts reported it) is +85.7% — the ~3-point gap is the real cost of not letting a plant grade its own homework. Reproduce with `bin/lopo_ef_eval.py`.

**External validity:** Verifier **B6** tests the same formula on **372 EU cement installations** (EUTL third-party-verified, EFs *not* fitted per-plant) — median ratio ≈1.0 vs EU-default ≈2.5×. This is the strongest generalization evidence in the repo.

A small in-browser WebGPU neural net (**iz**) exists as an **engineering demo** — at n=21 it does not beat the formula, so it is not part of the result and lives in a separate repo: [**iz-lab**](https://github.com/abgnydn/iz-lab). (A learned model becomes worth revisiting once the bench scales to the ~800 EUTL plant-labels; that's future work, not a v0 claim.)

If every TR operator used MRV-verified actuals instead of the EU default, on the order of **~€700M per year** stays in Turkey across the audit-grade facilities (a rough order-of-magnitude figure — it scales toward ~€1.5–2 bn/yr if extrapolated to all 59 CBAM-scope plants, but that extrapolation rests on coverage assumptions we have not validated, so treat it as illustrative). **Released under Apache-2.0** as open infrastructure for Turkish CBAM compliance — not a SaaS. Use it, cite it, contribute back.

This is a one-person project by [Ahmet Barış Günaydın](https://barisgunaydin.com) (<hi@barisgunaydin.com>).

---

## Özet (Türkçe)

AB, Türkiye'den ihraç edilen CBAM-kapsamlı ürünlere (çimento, çelik, alüminyum, gübre) karbon vergisi uyguluyor — varsayım değeri çoğu Türk tesisinin gerçek emisyonunun **2-10 katı**. **TR-MRV-Bench**, Türkiye CBAM-kapsamlı sanayisinin 59-tesislik kamuya açık veri setidir; 21'i için denetim-düzeyi Kapsam 1 etiketi vardır. Ana çıktı **cf-düzeltilmiş formüldür** — `tCO₂ = kapasite × emisyon-faktörü × kullanım-faktörü` — yalnızca operatörlerin yayımladığı sayıları kullanır. **Dürüst başlık: AB CBAM varsayımına karşı +%82.3 log-MAE azaltımı**, her tesisin emisyon-faktörünün yalnızca *diğer* tesislerden türetildiği **leave-one-plant-out** yöntemiyle ölçüldü (hiçbir tesis kendi cevabını görmez), rotasında en az bir başka tesis bulunan **21 tesisin 19'u** üzerinde. Kalan 2 tesis (BAGFAŞ ve Gübretaş) rotalarındaki tek tesis olduğundan bağımsız doğrulanamaz ve başlıktan hariç tutulur. Tüm tesislerin verisiyle (in-sample) hesaplanan eski sayı +%85.7'dir; ~3 puanlık fark, bir tesisin kendi ödevini kontrol etmesine izin vermemenin gerçek maliyetidir. Tarayıcıda çalışan WebGPU sinir ağı **iz** yalnızca bir mühendislik demosudur — bu veri ölçeğinde formülü geçmez, sonuca dahil değildir.

Her TR operatörü varsayım yerine bunu kullansa, denetim-düzeyi tesisler genelinde kabaca **yılda ~€700M** AB hazinesine gitmek yerine Türkiye'de kalır (yaklaşık bir büyüklük tahmini; tüm 59 tesise genellenirse ~€1.5–2 milyara ölçeklenir ama bu doğrulanmamış kapsam varsayımlarına dayanır). **Apache-2.0** ile TR CBAM uyumluluğu için açık altyapı olarak yayımlandı — SaaS değil. Kullanın, kaynak gösterin, katkıda bulunun.

Bu, tek kişilik bir projedir: [Ahmet Barış Günaydın](https://barisgunaydin.com) (<hi@barisgunaydin.com>).

---

## Quickstart

The headline path is pure Python — no browser, no GPU, runs in seconds.

```bash
git clone https://github.com/abgnydn/iz
cd iz
uv sync

# Build the bench (Climate TRACE + EUTL data are committed; refresh with bin/fetch_all_data.sh)
.venv/bin/python bin/export_bench_browser.py
.venv/bin/python bin/build_facilities_json.py
.venv/bin/python bin/build_facility_pages.py   # 59 per-facility pages + audit summaries

# The honest headline: leave-one-plant-out EF (+82.3%, n=19)
.venv/bin/python bin/lopo_ef_eval.py
.venv/bin/python bin/baselines.py              # B0 / B1 / B2 side by side

# External validity on 372 EUTL-verified EU cement plants
.venv/bin/python bin/verifier_b6_eutl_score.py
```

Tests: `.venv/bin/python -m pytest tests/` (sanity checks).

**The in-browser WebGPU demo (iz)** is not part of the result and lives in its own repo: [**github.com/abgnydn/iz-lab**](https://github.com/abgnydn/iz-lab).

---

> **Headline (v0, audit-grade disclosure facilities across all 4 CBAM scopes; capacity-corrected vs operator sources 2026-05-27):**
> - **B0 — EU CBAM default**: 0% (baseline), log-MAE 1.432.
> - **cf-corrected formula `cap × EF × cf`, leave-one-plant-out EF (honest, n=19)**: **+82.3% log-MAE reduction** vs EU default. This is the number to cite.
> - cf-corrected formula, in-sample EF (n=21, EF fitted on all plants): +85.7% — reported here only to show the ~3-point leakage gap.
> - **B6 — same formula on 372 EU cement plants (EUTL-verified, out-of-sample):** median ratio ≈1.0 vs EU-default ≈2.5×. External validity.
> - B3 — Climate TRACE direct on matched subset (n=5 audit-matched): under-reports 4 of 5, mean bias −17.2%.
> - **Excluded from the headline:** BAGFAŞ (N₂O-controlled) and Gübretaş (blender) — sole plant of their route, EF = their own answer, so not independently validatable.
>
> Coverage: all four CBAM scopes (cement, steel, aluminum, fertilizer) including primary vs downstream aluminum and N₂O-controlled vs integrated fertilizer. n is small (21 audit-grade, 19 validatable). We are honest about variance and confidence in Limitations. No satellite signal in v0. The in-browser neural net (iz) is a demo, not part of the result.

[**Paper preview (1-pager)**](https://iz-b0n.pages.dev/paper/) · [**Reproduce it**](https://iz-b0n.pages.dev/verify/) · [**Brain notes**](https://github.com/abgnydn/brain)

---

## What this is

**Two deliverables — the bench and the formula.** (A third artifact, the in-browser neural net, is a demo, not a result.)

1. **TR-MRV-Bench** — a public benchmark of 59 Turkish CBAM-scope facilities (34 cement, 16 steel, 3 aluminum, 6 fertilizer) with three-tier supervision: **21 audit-grade strong labels** from operator IARs / sustainability / TSRS reports / ISO 14064-1 verifications spanning all four CBAM scopes, 7 Climate TRACE per-asset labels, capacity-factor-corrected default labels for the remainder. Stratified by `(scope × route)` where route covers steel BF/BOF / EAF / DRI-EAF, aluminum primary / downstream, fertilizer integrated / N₂O-controlled / blender.

2. **cf-corrected formula** — closed-form `capacity × EF × cf` with route-aware EF priority (steel/Al/fertilizer route &gt; company-specific &gt; sector-mean) and cf priority (Climate TRACE per-asset &gt; disclosed-production-ratio &gt; sector-mean). **The primary deliverable.** Evaluated **leave-one-plant-out** (`bin/lopo_ef_eval.py`): on the 19 validatable plants it reaches **+82.3%** log-MAE reduction vs the EU default, predicting Erdemir Ereğli 1.09×, İsdemir 1.05×, Akçansa Çanakkale 1.12×, Batısöke 0.90× — all big emitters within ±20% *without ever seeing their own emission-factor*.

_The **iz** in-browser WebGPU model lives in the separate [**iz-lab**](https://github.com/abgnydn/iz-lab) repo as an **engineering demo** — "retrain a reference model in your browser in 3 seconds, no server." At n=21 it does not beat the closed-form formula, so it is deliberately kept out of this repo's headline and reproducibility path. It is a candidate for v1 once the bench scales to the ~800 EUTL plant-labels._

## Result

The formula, evaluated honestly — **leave-one-plant-out EF** (each plant's emission-factor is the median of what the *other* plants in its route imply, so no plant grades its own homework). Reproduce with `bin/lopo_ef_eval.py`.

| Method | n | Reduction vs EU default |
|---|---|--:|
| B0 EU CBAM default (log-MAE 1.432) | 21 | 0.0% (baseline) |
| B3 Climate TRACE direct (n=5 matched) | 5 | mean bias −17.2% (under-reports 4 of 5) |
| cf-corrected formula, **in-sample EF** (leaky) | 21 | +85.7% |
| **cf-corrected formula, leave-one-plant-out EF (honest)** | **19** | **+82.3%** |
| **B6 — formula on EUTL-verified EU cement (out-of-sample)** | 372 plants | median ratio ≈1.0 vs EU-default ≈2.5× |

Per-facility, honest (LOPO) ratios. The last two rows are the **only** plant of their route in the dataset, so their "emission-factor" is literally their own answer — not independently validatable, excluded from the headline:

| Facility | Route | Truth tCO₂ | EU default | Ratio (honest, LOPO) | Validatable? |
|---|---|--:|--:|--:|:--:|
| İsdemir İskenderun | steel · BF/BOF | 10,663,364 | 10,070,000 | 1.05× | ✅ |
| Erdemir Ereğli | steel · BF/BOF | 6,667,232 | 7,600,000 | 1.09× | ✅ |
| Kardemir Karabük | steel · BF/BOF | 5,650,626 | 6,650,000 | 0.88× | ✅ |
| Nuh Hereke | cement | 3,584,953 | 9,028,800 | 0.69× | ✅ |
| Akçansa Çanakkale | cement | 3,466,000 | 8,712,000 | 1.12× | ✅ |
| Göltaş Isparta | cement | 1,669,072 | 7,920,000 | 1.18× | ✅ |
| Batısöke Söke | cement | 1,577,926 | 6,336,000 | 0.90× | ✅ |
| Akçansa Büyükçekmece | cement | 1,514,000 | 3,960,000 | 1.18× | ✅ |
| Afyon Çimento | cement | 1,200,000 | 2,851,200 | 0.59× | ✅ |
| Bursa Çimento | cement | 1,121,545 | 3,168,000 | 0.63× | ✅ |
| Habaş Aliağa | steel · EAF | 830,338 | 8,550,000 | 1.01× | ✅ |
| Çolakoğlu Gebze | steel · EAF | 566,519 | 8,550,000 | 0.95× | ✅ |
| Akçansa Ladik | cement | 499,000 | 1,584,000 | 1.19× | ✅ |
| Toros Mersin | fert · integrated | 383,150 | 648,000 | 0.73× | ✅ |
| İzdemir Aliağa | steel · EAF | 271,123 | 2,850,000 | 1.04× | ✅ |
| Toros Samsun | fert · integrated | 255,180 | 460,000 | 0.81× | ✅ |
| Toros Ceyhan | fert · integrated | 203,840 | 657,360 | 1.85× | ✅ |
| Assan Tuzla | alu · downstream | 108,500 | 540,000 | 0.85× | ✅ |
| ASAŞ Akyazı | alu · downstream | 68,618 | 375,000 | 1.17× | ✅ |
| Gübretaş Yarımca | fert · blender | 13,281 | 640,000 | — | ❌ single-plant |
| BAGFAŞ Bandırma | fert · N₂O-controlled | 9,828 | 560,000 | — | ❌ single-plant |

**14 of the 19 validatable facilities land within ±20% of audit truth.** The honest weak spots are visible and named: Toros Ceyhan 1.85× (capacity-share is the wrong allocation key for NH₃+urea-heavy Toros plants — needs process-tonnage disclosures Toros doesn't publish), and Afyon/Bursa/Nuh cement ~0.6–0.7× (their true capacity factor sits above the sector default). Steel and cement — the strata with ≥3 plants — are the most robust.

## Limitations (paper §8 honest version)

1. **n=21 is small; only 19 are validatable.** Twenty-one audit-grade facilities, of which two are the sole plant of their route — leaving **19** that can be tested leave-one-plant-out. This is the honest denominator for the headline.
2. **Single-instance strata cannot be validated.** BAGFAŞ (N₂O-controlled fertilizer) and Gübretaş (blender) are the only plants of their route in the dataset. Their emission-factor is fit to their own audited number, so any "prediction" of them is circular. They are **excluded from the headline** and shown for illustration only. This is the single biggest caveat and the reason the honest number is n=19, not n=21.
3. **In-sample vs leave-one-plant-out.** Earlier drafts reported +85.3% with the EF fitted on all plants (in-sample). The honest, no-peeking number is **+82.3%** (LOPO, n=19). We report both and cite the honest one; the ~3-point gap is real and expected.
4. **No satellite signal in v0.** The S5P NO₂ pipeline runs but didn't make it into the formula. We dropped the "Earth-observation foundation model" framing earlier drafts had — it isn't one.
5. **The neural net is a demo, not a result.** iz (in-browser WebGPU, ~500-param MLP on ~40 samples) does not beat the closed-form formula at this data scale. It is kept out of the headline and the reproducibility path on purpose. Revisit once the bench scales (the EUTL pull adds ~800 plant-labels).
6. **Operator-self-reported truths.** Strong labels come from operator IARs / sustainability reports / TSRS-compliant disclosures (mostly Big4-audited, several ISO 14064-1 verified). Not third-party-verified. This is the same trust problem Climate TRACE tries to bypass.
7. **Climate TRACE under-reporting claim is sample-size 5.** CT under-reports 4 of 5 audit-matched TR facilities (Erdemir −29%, İsdemir −22%, Kardemir −23%, Nuh −23%; Göltaş +11%), mean bias −17.2%. We do *not* claim CT is wrong globally — only that on these 5 audit-matched TR facilities it consistently underestimates.
8. **BF/BOF stratum (n=3) is trivially partitioned under leave-one-plant-out.** With only 3 BF/BOF mills in TR (Erdemir, İsdemir, Kardemir), leave-one-out is "predict from the other 2". Not a real generalization test on this stratum.
9. **Capacity-factor variance is the dominant residual.** The cement under-predictions — Afyon 0.59×, Bursa 0.63×, Nuh 0.69× — run at actual capacity factors above the cement-sector default 0.55 used in the formula prior when they are held out. This is honest leave-one-plant-out behavior: cf is plant-specific and not predictable from capacity alone.
10. **Allocated labels.** Akçansa per-plant labels are allocated from group total by clinker-production share. Toros Tarım Mersin/Samsun/Ceyhan are allocated from group total 842,174 tCO₂ by nameplate capacity. Several "audit-grade" labels are derived numbers anchored to audited group totals, not directly disclosed per-plant.
11. **Some capacities in `tr_facilities.csv` were corrected mid-session** (Çanakkale 4.5M → 6M; Erdemir Ereğli 6M → 4M crude steel). Other facilities may have similar nameplate errors we haven't audited.

## Reproducibility

The Climate TRACE weak labels (`reports/climate_trace_tr*.parquet`) and the EUTL
verified-emissions snapshot for the B6 external-validity check
(`data/eutl/*.parquet`) are **committed to the repo**, so a clean clone
reproduces the headline and the verifier offline — no browser, no GPU. To refresh
them from source (all public, no auth), run `bin/fetch_all_data.sh`.

```bash
# Setup — pure Python, runs in seconds
git clone https://github.com/abgnydn/iz
cd iz
uv sync

# (optional) refresh all external data from source — Climate TRACE + EUTL
bin/fetch_all_data.sh

# Build the bench (reads the committed Climate TRACE parquets)
uv run python bin/export_bench_browser.py

# The honest headline: leave-one-plant-out EF (+82.3%, n=19)
uv run python bin/lopo_ef_eval.py
uv run python bin/baselines.py

# External validity on 372 EUTL-verified EU cement plants
uv run python bin/verifier_b6_eutl_score.py
```

**The in-browser WebGPU demo (iz)** is not part of this result and lives in its own repo — [**github.com/abgnydn/iz-lab**](https://github.com/abgnydn/iz-lab).

## Methodology highlights

- **Leave-one-plant-out EF** (`bin/lopo_ef_eval.py`) — the honest evaluation. Each plant's emission-factor is the median implied EF (`truth / (cap × cf)`) of the *other* plants in its route, so no plant contributes to its own prediction. Routes with a single plant are reported as unvalidatable rather than scored.
- **Route-aware EF** (`is_bfbof / is_eaf / is_dri_eaf`, aluminum primary/downstream, fertilizer integrated/N₂O/blender) — EAF mills emit 5-10× less Scope 1 per tonne than BF/BOF; steel EF alone would massively over-predict EAF.
- **Disclosed-cf table** — capacity factor = production/capacity derived from IAR text. Non-leaky w.r.t. Scope 1 because production tonnage is disclosed independently of emissions; only the EF was ever fitted, which is what LOPO corrects for.
- **Capacity-factor-corrected labels** — replace raw `capacity × EU_default_EF` with `capacity × TR_actual_EF × cf`. The formula matches Habaş Aliağa audited Scope 1 within 2% (843k vs 830k, leave-one-plant-out).
- _Demo only:_ the WebGPU model trains against the residual `y_log − log(cap × EF × cf)` — it lives in the separate [iz-lab](https://github.com/abgnydn/iz-lab) repo and is not used in this headline.

## Data sources

All raw disclosure PDFs live under `data/disclosures/` (gitignored by default for size; download links and pages cited inline):

| Company | Year | Number | Source |
|---------|------|--------|--------|
| Akçansa group | 2025 | 5,484,015 tCO₂e + per-plant clinker | [2025 IAR p46+167](https://www.akcansa.com.tr/wp-content/uploads/2026/04/Akcansa_EFR_EN-21-nisan-v2.pdf) |
| Çolakoğlu Dilovası | 2024 | 566,519 | [2024 SR p82](https://www.colakoglu.com.tr/uploads/file/colakoglu-sr-24-en-08.pdf) |
| Çolakoğlu Dilovası | 2021–2023 | 517 / 493 / 495 kt | 2024 SR p82 time-series |
| Erdemir Group | 2024 | 17,336,630 | [2024 Entegre IAR p103 (KGK)](https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/Raporlar/ERDEMIR2024EntegreFaaliyetRaporu.pdf) |
| İsdemir | 2024 | 10,663,364 | Erdemir 2024 IAR p115 |
| Erdemir Ereğli | 2024 | 6,667,232 | Direct: 2024 IAR p79 (kgk-verified) |
| Erdemir Ereğli | 2023 | 6,559,030 | [Tracenable](https://tracenable.com/company/erdemir/ghg-emissions) |
| Kardemir Karabük | 2022 | 5,539,756 | [2022 SR p61 (KGK)](https://www.kgk.gov.tr/Portalv2Uploads/files/Duyurular/v2/Surdurulebilirlik/Raporlar/Kardemir%202022%20y%C4%B1l%C4%B1%20S%C3%BCrd%C3%BCr%C3%BClebilirlik%20Raporu.pdf) |
| Nuh Hereke | 2024 | 3,584,953 (TSRS refined, cement-only parent) | [2024 IAR p59](https://www.nuhcimento.com.tr/wp-content/uploads/Nuh-Cimento-2024-Integrated-Annual-Report-1.pdf) |
| OYAK Çimento group | 2023 | 7,712,391 | [2023 Integrated Report p30](https://assets.oyakcimento.com/contents/pdf/2024255/85591726125090012652.pdf) |
| Limak Çimento group | 2023 | 7,138,623 | [2023 SR p89](https://www.limakcimento.com/assets/images/dosya/sustainability-report-2023_1751267090.pdf) |
| Climate TRACE per-asset | 2024 | 13 TR facilities | api.climatetrace.org `/v6/assets/{id}` |
| TR Cement industry avg EF | 2023 | 0.643 t/t cement | TÜRKÇİMENTO 2023 Sürdürülebilirlik Raporu |

## Deploy

The site (`site/`) is served on [Cloudflare Pages](https://iz-b0n.pages.dev) via the
GitHub integration — there is no `wrangler.toml` in the repo, so **merging to `master`
auto-builds and deploys** (the `site/_redirects` rules apply automatically). No manual
step. For a direct-upload project or a manual preview: `just deploy` (=
`wrangler pages deploy site --project-name iz-b0n`).

Common tasks are in the `justfile`: `just repro` (headline), `just build`,
`just test`, `just fetch-data`, `just all`.

## Layout

```
src/iz/               ← Python package (bench schema, scrapers, CT client) + bench.json
                        (the in-browser WebGPU demo moved to github.com/abgnydn/iz-lab)
bin/                  ← Reproducibility scripts: pull / export / eval / verifiers / figures
data/                 ← raw + processed (mostly gitignored; EUTL + Climate TRACE committed)
data/tr_facilities.csv                 ← 59 TR CBAM-scope facilities
data/tr_facility_known_emissions.csv   ← audit-grade + weak strong-label rows (21 audit-grade)
reports/              ← Generated artifacts: lopo_ef_eval.json, fig_formula_vs_eu.svg
site/                 ← the public site (deployed to iz-b0n.pages.dev)
CHANGELOG.md          ← version history (v0.3 → v0.4 correction)
CLAUDE.md             ← development log
```

## Cite

```bibtex
@misc{gunaydin2026trmrvbench,
  title  = {TR-MRV-Bench: a public per-facility emissions benchmark for Turkish CBAM-scope industry},
  author = {Ahmet Barış Günaydın},
  year   = {2026},
  publisher = {Zenodo},
  doi    = {10.5281/zenodo.20496086},
  url    = {https://doi.org/10.5281/zenodo.20496086},
  note   = {Apache-2.0; honest headline +82.3\% log-MAE reduction vs EU CBAM default, leave-one-plant-out, n=19}
}
```

## License

Code + bench + weights all Apache-2.0 (cite-us).
