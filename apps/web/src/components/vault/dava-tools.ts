'use client';

// DavaKasası-specific document analyzers + work-product exporters.
//
// Pure functions over VaultDoc[] — no DOM, no React. The slide-in panel
// (`dava-panel.tsx`) wraps these in buttons that produce CSV blobs the
// lawyer downloads as work product (kronoloji table, privilege log, witness
// list) or that augment the 3D graph with new edges (citation extractor).
//
// Everything is local-first by construction: no calls leave the browser,
// no LLM step, no network. Heuristics only — when a heuristic misses,
// the lawyer sees the empty cell instead of a hallucinated value.

import type { VaultDoc, VaultTint } from './vault-store';

// ─── Date extraction ────────────────────────────────────────────────

const TR_MONTHS: Record<string, number> = {
  ocak: 1, şubat: 2, subat: 2, mart: 3, nisan: 4,
  mayıs: 5, mayis: 5, haziran: 6, temmuz: 7, ağustos: 8, agustos: 8,
  eylül: 9, eylul: 9, ekim: 10, kasım: 11, kasim: 11, aralık: 12, aralik: 12,
};

export interface DateHit {
  /** ISO date YYYY-MM-DD. */
  iso: string;
  /** Original surface form as it appeared in the document. */
  raw: string;
  /** Character offset in the document where the match starts. */
  offset: number;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function plausible(year: number, month: number, day: number): boolean {
  if (year < 1800 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

/** Pull every plausible date out of `text`. Handles:
 *    - Numeric DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
 *    - ISO YYYY-MM-DD
 *    - Turkish "DD <ay adı> YYYY" (e.g. "17 Mart 2024", with diacritic-tolerance)
 *  Returns hits in source order; ambiguous strings are dropped silently. */
export function extractDates(text: string): DateHit[] {
  const hits: DateHit[] = [];

  const numeric = /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = numeric.exec(text))) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (!plausible(year, month, day)) continue;
    hits.push({
      iso: `${year}-${pad(month)}-${pad(day)}`,
      raw: m[0],
      offset: m.index,
    });
  }

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(text))) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (!plausible(year, month, day)) continue;
    hits.push({ iso: `${year}-${pad(month)}-${pad(day)}`, raw: m[0], offset: m.index });
  }

  const turkish = /\b(\d{1,2})\s+(Ocak|Şubat|Subat|Mart|Nisan|Mayıs|Mayis|Haziran|Temmuz|Ağustos|Agustos|Eylül|Eylul|Ekim|Kasım|Kasim|Aralık|Aralik)\s+(\d{4})\b/gi;
  while ((m = turkish.exec(text))) {
    const day = parseInt(m[1], 10);
    const month = TR_MONTHS[m[2].toLowerCase()];
    const year = parseInt(m[3], 10);
    if (!plausible(year, month, day)) continue;
    hits.push({ iso: `${year}-${pad(month)}-${pad(day)}`, raw: m[0], offset: m.index });
  }

  hits.sort((a, b) => a.offset - b.offset);
  return hits;
}

// ─── Kronoloji (chronology) ────────────────────────────────────────

export interface KronolojiEntry {
  iso: string;
  raw: string;
  docId: string;
  docTitle: string;
  /** ~120 chars of surrounding text from the document, single-line. */
  context: string;
}

function snippet(text: string, offset: number, span = 120): string {
  const start = Math.max(0, offset - span / 2);
  const end = Math.min(text.length, offset + span / 2);
  return text
    .slice(start, end)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Walk every doc, collect every dated mention, sort chronologically. */
export function buildKronoloji(docs: VaultDoc[]): KronolojiEntry[] {
  const out: KronolojiEntry[] = [];
  for (const doc of docs) {
    for (const hit of extractDates(doc.content)) {
      out.push({
        iso: hit.iso,
        raw: hit.raw,
        docId: doc.id,
        docTitle: doc.title,
        context: snippet(doc.content, hit.offset),
      });
    }
  }
  out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
  return out;
}

function csvCell(s: string): string {
  // RFC 4180: wrap in quotes if value contains comma/quote/newline; double
  // any inner quotes. A UTF-8 BOM is prepended at the file level so Excel-TR
  // opens the file with correct encoding.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

const CSV_BOM = '﻿';

export function kronolojiToCsv(entries: KronolojiEntry[]): string {
  const head = csvRow(['Tarih', 'Belge', 'Bağlam', 'Kaynak ifadesi']);
  const rows = entries.map((e) =>
    csvRow([e.iso, e.docTitle, e.context, e.raw]),
  );
  return CSV_BOM + [head, ...rows].join('\n') + '\n';
}

// ─── İmtiyaz (privilege) log ────────────────────────────────────────

export interface ImtiyazRow {
  docId: string;
  docTitle: string;
  tint: VaultTint;
  /** Localized class label, e.g. "Müvekkil–Avukat Gizli". */
  tintLabel: string;
  /** ISO timestamp of last update — auditors want the freshness. */
  updatedAt: string;
}

/** Group docs by tint with a stable label order: violet → amber → cyan → rose. */
export function buildImtiyazLog(
  docs: VaultDoc[],
  tintLabels: Partial<Record<VaultTint, string>>,
): ImtiyazRow[] {
  const order: VaultTint[] = ['violet', 'amber', 'cyan', 'rose'];
  const rank = new Map(order.map((t, i) => [t, i] as const));
  const rows = docs.map<ImtiyazRow>((d) => ({
    docId: d.id,
    docTitle: d.title,
    tint: d.tint,
    tintLabel: tintLabels[d.tint] ?? d.tint,
    updatedAt: new Date(d.updatedAt).toISOString(),
  }));
  rows.sort((a, b) => {
    const r = (rank.get(a.tint) ?? 99) - (rank.get(b.tint) ?? 99);
    return r !== 0 ? r : a.docTitle.localeCompare(b.docTitle, 'tr');
  });
  return rows;
}

export function imtiyazLogToCsv(rows: ImtiyazRow[]): string {
  const head = csvRow(['Sınıf', 'Belge', 'Son güncelleme', 'Belge kimliği']);
  const body = rows.map((r) =>
    csvRow([r.tintLabel, r.docTitle, r.updatedAt, r.docId]),
  );
  return CSV_BOM + [head, ...body].join('\n') + '\n';
}

// ─── Tanık (witness) extraction ─────────────────────────────────────

const TANIK_LINE = /(?:^|\n)\s*(?:[-*•]\s*)?Tanık(?:\s+adı)?\s*[:\-—]\s*([^\n]+)/gi;

export interface TanikHit {
  name: string;
  docId: string;
  docTitle: string;
}

/** Extract names from explicit "Tanık:" / "Tanık adı:" lines. Loose matching
 *  on purpose — the lawyer reviews + dedupes; we just collect candidates. */
export function extractTanikList(docs: VaultDoc[]): TanikHit[] {
  const out: TanikHit[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    TANIK_LINE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TANIK_LINE.exec(doc.content))) {
      const name = m[1].trim().replace(/[.;,]+$/, '');
      if (!name) continue;
      const key = `${doc.id}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, docId: doc.id, docTitle: doc.title });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  return out;
}

export function tanikListToCsv(hits: TanikHit[]): string {
  const head = csvRow(['Tanık', 'Belge']);
  const body = hits.map((h) => csvRow([h.name, h.docTitle]));
  return CSV_BOM + [head, ...body].join('\n') + '\n';
}

// ─── İçtihat (case-law citation) extraction ─────────────────────────

/** Canonical citation reference, tightly normalized so two surface forms of
 *  the same case collapse to one node in the citation graph. */
export interface IctihatRef {
  /** Court family. */
  court: 'yargitay' | 'danistay' | 'aym';
  /** Daire number, when present. AYM may have no daire. */
  daire?: number;
  /** Esas (E.) numarası. */
  esas: string;
  /** Karar (K.) numarası. */
  karar: string;
}

export interface IctihatHit {
  ref: IctihatRef;
  /** Stable per-citation key used as a graph node id. */
  key: string;
  raw: string;
  docId: string;
  docTitle: string;
  offset: number;
}

const RE_YARGITAY = /Yargıtay\s+(\d{1,2})\.\s*(?:Hukuk|Ceza)\s*(?:Dairesi|Genel\s+Kurulu)?[\s,.]+E\.?\s*(\d{4})\/(\d+)[\s,.]+K\.?\s*(\d{4})\/(\d+)/gi;
const RE_DANISTAY = /Danıştay\s+(\d{1,2})\.\s*(?:Daire|Daire\s+Başkanlığı)?[\s,.]+E\.?\s*(\d{4})\/(\d+)[\s,.]+K\.?\s*(\d{4})\/(\d+)/gi;
const RE_AYM = /(?:Anayasa\s+Mahkemesi|AYM)[\s,.]+(?:E\.?\s*(\d{4})\/(\d+)[\s,.]+K\.?\s*(\d{4})\/(\d+)|(?:Başvuru\s+No[:.]?\s*)?(\d{4})\/(\d+))/gi;

export function refKey(ref: IctihatRef): string {
  const head = ref.court + (ref.daire !== undefined ? `-d${ref.daire}` : '');
  return `${head}-E${ref.esas}-K${ref.karar}`;
}

export function extractIctihat(text: string): Array<{ ref: IctihatRef; raw: string; offset: number }> {
  const hits: Array<{ ref: IctihatRef; raw: string; offset: number }> = [];

  RE_YARGITAY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_YARGITAY.exec(text))) {
    hits.push({
      ref: {
        court: 'yargitay',
        daire: parseInt(m[1], 10),
        esas: `${m[2]}/${m[3]}`,
        karar: `${m[4]}/${m[5]}`,
      },
      raw: m[0],
      offset: m.index,
    });
  }

  RE_DANISTAY.lastIndex = 0;
  while ((m = RE_DANISTAY.exec(text))) {
    hits.push({
      ref: {
        court: 'danistay',
        daire: parseInt(m[1], 10),
        esas: `${m[2]}/${m[3]}`,
        karar: `${m[4]}/${m[5]}`,
      },
      raw: m[0],
      offset: m.index,
    });
  }

  RE_AYM.lastIndex = 0;
  while ((m = RE_AYM.exec(text))) {
    // Two alternation branches: full E./K. form, or "Başvuru No 2024/123".
    const esasYear = m[1] ?? m[5];
    const esasNum = m[2] ?? m[6];
    const kararYear = m[3] ?? esasYear;
    const kararNum = m[4] ?? esasNum;
    if (!esasYear || !esasNum) continue;
    hits.push({
      ref: {
        court: 'aym',
        esas: `${esasYear}/${esasNum}`,
        karar: `${kararYear}/${kararNum}`,
      },
      raw: m[0],
      offset: m.index,
    });
  }

  hits.sort((a, b) => a.offset - b.offset);
  return hits;
}

/** Apply extractIctihat across the vault, attaching doc context. */
export function extractIctihatAcrossVault(docs: VaultDoc[]): IctihatHit[] {
  const out: IctihatHit[] = [];
  for (const doc of docs) {
    for (const h of extractIctihat(doc.content)) {
      out.push({
        ref: h.ref,
        key: refKey(h.ref),
        raw: h.raw,
        docId: doc.id,
        docTitle: doc.title,
        offset: h.offset,
      });
    }
  }
  return out;
}

/** For each citation that appears in ≥2 docs, produce undirected edges
 *  between those docs. The lawyer's vault gains a "shared-precedent"
 *  cluster they wouldn't see from wikilinks alone. */
export function ictihatCoCitationEdges(hits: IctihatHit[]): Array<[string, string]> {
  const docsByRef = new Map<string, Set<string>>();
  for (const h of hits) {
    if (!docsByRef.has(h.key)) docsByRef.set(h.key, new Set());
    docsByRef.get(h.key)!.add(h.docId);
  }
  const edges: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const ids of docsByRef.values()) {
    if (ids.size < 2) continue;
    const arr = [...ids];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i] < arr[j] ? arr[i] : arr[j];
        const b = arr[i] < arr[j] ? arr[j] : arr[i];
        const key = `${a}|${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([a, b]);
      }
    }
  }
  return edges;
}

// ─── Browser download helper ────────────────────────────────────────

/** Trigger a CSV download. Pure browser API — no React, no upload. */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari has time to start the download stream.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
