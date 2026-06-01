# davakasasi

**[davakasasi.pages.dev](https://davakasasi.pages.dev)** · **[abgnydn/davakasasi](https://github.com/abgnydn/davakasasi)**

**Local-first AI vault for Turkish attorneys.** Müvekkil dosyaları cihazdan çıkmaz — Claude / ChatGPT sorularını yanıtlar, ama veriler cihazında kalır. A vertical-wedge derivative of [markview](https://github.com/abgnydn/markview) targeting Turkish solo and small-firm lawyers.

## The compliance thesis

[KVKK Law 7499 (OG 12 March 2024)](https://www.resmigazete.gov.tr/eskiler/2024/03/20240312-1.htm) killed *açık rıza* as a basis for regular cross-border data transfers. Turkish lawyers who use ChatGPT or Claude on client data now need filed standard contracts and still risk **TCK 136 criminal liability** per the Ankara Barosu HUBİTEM 2024 rehberi. Local-first isn't a preference here — it's the **compliance category**.

## What it does

- **Matter vault** — every client matter is a folder of `.md` notes, briefs, hearings, contracts.
- **AI on your device** — local LLM (Ollama, BitNet, or browser-side via the [zero-tvm](https://github.com/abgnydn/zero-tvm) stack) reads the matter and answers questions. The model sees the case; no cloud does.
- **Optional cloud assist via [veil](https://github.com/abgnydn/veil)** — when you do want a frontier-model answer, names and identifiers are pseudonymized round-trip before they leave the device.
- **Markdown all the way down** — works in any editor, exports to docx / pdf / printed brief format.

## Layout

```
davakasasi/
├── app/page.tsx                   ← Next.js entry surface
├── components/dava-tools.ts       ← matter-vault primitives (lift from markview's vault crate)
├── public/                        ← davakasasi.html + davakasasi-world.html landings
├── tests/dava-tools.test.ts
└── .brain/                        ← thinking + GTM notes (not shipped)
```

## Lineage

Extracted from [markview](https://github.com/abgnydn/markview) on 2026-05-15. The vault primitives and the markdown rendering pipeline come from there; the matter-vault wrapper, KVKK-aware export, and Turkish-lawyer UX live here.

## Related

- [markview](https://github.com/abgnydn/markview) — parent product (general-purpose markdown vault)
- [veil](https://github.com/abgnydn/veil) — privacy layer for optional cloud assist
- [zero-tvm](https://github.com/abgnydn/zero-tvm) / [fused-lora](https://github.com/abgnydn/fused-lora) — on-device LLM inference + adaptation

## License

MIT
