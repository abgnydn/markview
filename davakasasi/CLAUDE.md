# DavaKasası — Matter Vault TR

Turkish legal-tech GTM built on top of `markview`. Local-first AI vault for Turkish lawyers: *müvekkil dosyaları cihazdan çıkmaz*. Bolu beachhead at **₺500/ay** direct sales.

**Single source of truth** for plan, market research, competitive map, pricing, entity/tax, and open questions: `~/brain/projects/davakasasi.md`. Do not duplicate that content here — load it before acting.

## Code locations this workstream touches

All DavaKasası code changes land in the existing `markview` apps, *not* in this folder. This folder holds plan pointers, compliance assets, and Turkish copy.

- `apps/web/public/davakasasi.html` — **Turkish landing page with 3D hero vault + workflow scene.** Standalone HTML, no build, served at `/davakasasi.html`. Liftable to `davakasasi.com` as-is when domain is registered. (Added 2026-04-24.)
- `apps/web/src/app/vault/` — the vault UI
- `apps/web/src/components/vault/` — vault components (store, orbit, modal, topbar, links, tfidf, embeddings, experience, hooks)
- `apps/mcp/` — MCP tools surface
- `apps/context-vault/` — Electron app; has `mammoth`, `pdf-parse`, `xlsx` already wired — migrate into web
- This folder (`davakasasi/`) — Turkish assets, compliance PDFs, translation JSONs, this plan pointer

## 🎯 Resume here (on "continue")

Source: `~/brain/projects/davakasasi.md` — Resume-here block. Mirrored below for bare `continue` in this folder. Brain remains authoritative; if mismatched, brain wins.

**✅ Shipped (as of 2026-04-25):**

- `.docx/.pdf/.xlsx/.csv/.udf` ingest with drag-drop UI (`apps/web/src/components/vault/vault-ingest.ts` + `vault-experience.tsx`).
- Multilingual-e5-small embeddings (`vault-embeddings.ts`).
- Turkish-first i18n with `?lang=` override (`apps/web/src/i18n/`).
- UYAP `.udf` parser (CP1254 RTF decoder in `vault-ingest.ts`).
- Graph query layer: `vault-graph-queries.ts` — BFS over wikilink + semantic adjacency.
- Modal "Related within N hops" panel (1 / 2 / 3 selector, click-to-navigate).
- 5 MCP graph tools in `apps/mcp/src/index.ts`: `get_related_within_hops`, `get_shortest_path`, `get_ego_graph`, `get_vault_hubs`, `get_communities`.

**⏳ Next, in order — first `continue` executes step 1 (domain check):**

1. Verify domain availability — `davakasasi.com` and `.com.tr`. Fall back to alternatives if taken.
2. Draft the 3 compliance PDFs into `davakasasi/` — **KVKK Uyumluluk Beyanı** (hero asset), **TCK 136 Risk Karşılaştırması**, **Teknik Mimari Eki**. Turkish, plain-language, law-office-grade design.
3. Call top-3 Bolu contacts. Demo. Get 1 paid signup before building more.
4. Privilege-tag tint mapping (cyan = Halka Açık, amber = İş Ürünü, violet = Müvekkil–Avukat Gizli) in the vault store; surface in modal header.
5. Export pipelines — kronoloji CSV + privilege log.
6. Promote `apps/web/public/davakasasi.html` to `davakasasi.com` once the domain is registered.

## Work agreement specific to this scope

- **Turkish-first UI copy.** English is the fallback. Never ship a DavaKasası view with only English microcopy.
- **KVKK posture is the product.** Every feature change must pass the question *"does this preserve the 'data never leaves the device' promise?"* If the answer is no or unclear, flag it before shipping.
- **No cloud AI by default.** Any feature that depends on cloud inference must be opt-in and clearly labeled.
- **Bolu first, everywhere else second.** When in doubt, optimize the workflow for a solo Bolu lawyer reviewing a `.udf`-heavy matter, not for a generic user.
