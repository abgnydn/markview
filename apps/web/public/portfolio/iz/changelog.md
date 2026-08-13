# Changelog

## v0.4.2 — live URL moved to iz-mrv.pages.dev (patch)

The public site moved from `iz-b0n.pages.dev` to **`iz-mrv.pages.dev`**. Every
reference was updated in one pass and the artifacts rebuilt from source:

- `SITE_URL` and all canonical / `og:url` tags across the site, the sitemap,
  `robots.txt`, README, `.zenodo.json`, and `CITATION.cff`.
- The main Open Graph card (`site/assets/og.png`) and all 59 per-facility OG
  cards were re-rendered so the baked-in URL matches.
- Cut a fresh release so the Zenodo archive links to the live host instead of
  the retired `iz-b0n` subdomain. No data, method, or headline numbers changed.

## v0.4.1 — audit corrections (patch)

A multi-round comprehensive audit of v0.4.0 caught and fixed real errors that had
survived into the v0.4.0 release:

- **Paper Table 1** was a stale neural-net table mislabeled "formula (LOPO)" — wrong
  per-facility ratios, a missing plant (Bursa), and flipped Δ-vs-EU signs. Regenerated
  from the honest data.
- **Erdemir** (6,673,266 derived → 6,667,232 audit-grade) and **Nuh** (duplicate rows
  reconciled to 3,584,953) truth values corrected at source.
- **Conformal intervals** on facility pages were computed from the removed neural net;
  recomputed from the formula's leave-one-plant-out predictions (n=19, 94.7% coverage).
- Fixed a facility-page capacity-formatting bug, the CSV column names, the OG social
  image (−85.9% → −82.3%), the assurance-tier counts, and the Climate-TRACE label count.
- **Conciseness pass:** deleted ~191 dead/duplicate/superseded files (the unlinked
  drifting JSON API, the fusion scripts + reports, superseded drafts, orphaned
  marketing) — fewer surfaces, fewer places for errors.

## v0.4.0 — honest leave-one-plant-out headline (correction release)

This is a **correction release**. Earlier versions (v0.3.x) overstated the headline
and cited a verifier that has since been withdrawn. Please cite this version.

### Corrected

- **Headline is now +82.3%**, measured **leave-one-plant-out** over the **19
  validatable plants**, superseding the earlier **+85.3% in-sample** figure. The
  route emission-factors had been hand-fit from the same audit-grade plants they
  were then scored on; for single-plant routes that amounted to grading the formula
  against its own answer. `bin/lopo_ef_eval.py` recomputes each plant's emission-factor
  from only the *other* plants in its route.
- **Two plants excluded from the headline**: BAGFAŞ (sole N₂O-controlled fertilizer
  plant) and Gübretaş (sole blender). Each is the only plant of its route, so it cannot
  be validated leave-one-plant-out. They are shown for illustration only.
- The in-sample fit (EF fitted on all plants) is **+85.7%**; the ~3-point gap is the
  real cost of not letting a plant see its own answer.

### Withdrawn

- **Verifier B7 (PySR symbolic-regression "independent rediscovery")** is withdrawn as
  **circular**: it was given inputs `(cap, ef, cf)` and the target `log(scope1)` where
  `scope1 ≈ cap × ef × cf` by construction, so recovering `log(cap)+log(ef)+log(cf)` was
  guaranteed, not independent evidence. The B7 script and its "triple-corroborated"
  framing have been removed.

### Retained

- **Verifier B6 (EUTL external validity)** stands: the same formula, with no re-tuning,
  applied to **789 EUTL third-party-verified EU plants** across all four CBAM scopes
  (10,691 facility-years) gives a median ratio ≈1.0 vs the EU default's ≈2.5× on cement.
  This is the strongest generalization evidence and is now the headline external check.

### Changed

- The in-browser WebGPU neural net (**iz**) is reframed as an **engineering demo, not a
  result** — at n=21 it does not beat the closed-form formula. It moved to a separate
  repo: <https://github.com/abgnydn/iz-lab>.
- `bench.json` relocated to `src/iz/`. The public bench browser and per-facility pages
  now feature the formula's leave-one-plant-out prediction.
- Site cut to the core (removed `landing`/`v01`/`fusion`/`verifiers`, 301-redirected);
  `/verify/` rewritten as a pure-Python reproduction guide.
- EUTL data committed + `bin/fetch_all_data.sh` added so a clean clone reproduces the
  headline and B6 offline. `iz-1` renamed to `iz` throughout.
- The `~€700M/yr` figure is stated as an order-of-magnitude estimate; the €1.5–2 bn
  extrapolation is labeled illustrative and unvalidated.

## v0.3.x and earlier

Reported an in-sample +85.3% headline, a "+83.3%" neural-net result, and a
"triple-corroborated" claim including the now-withdrawn PySR/B7 rediscovery. Superseded
by v0.4.0.
