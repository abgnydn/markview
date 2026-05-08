import { describe, it, expect } from 'vitest';
import {
  extractDates,
  buildKronoloji,
  kronolojiToCsv,
  buildImtiyazLog,
  imtiyazLogToCsv,
  extractTanikList,
  extractIctihat,
  extractIctihatAcrossVault,
  ictihatCoCitationEdges,
  refKey,
} from '@/components/vault/dava-tools';
import type { VaultDoc } from '@/components/vault/vault-store';

function doc(id: string, title: string, content: string, opts: Partial<VaultDoc> = {}): VaultDoc {
  return {
    id,
    title,
    content,
    tint: opts.tint ?? 'cyan',
    createdAt: opts.createdAt ?? 0,
    updatedAt: opts.updatedAt ?? 1_700_000_000_000,
  };
}

describe('dava-tools · extractDates', () => {
  it('parses numeric DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY', () => {
    const hits = extractDates('Olay 17.03.2024 günü, sözleşme 1/4/2025, fatura 03-12-2024.');
    expect(hits.map((h) => h.iso)).toEqual(['2024-03-17', '2025-04-01', '2024-12-03']);
  });

  it('parses Turkish month names with diacritic-tolerance', () => {
    const hits = extractDates('17 Mart 2024 tarihli yazı, 5 Aralık 2023 dilekçesi, 22 Subat 2025.');
    expect(hits.map((h) => h.iso).sort()).toEqual([
      '2023-12-05',
      '2024-03-17',
      '2025-02-22',
    ]);
  });

  it('parses ISO YYYY-MM-DD', () => {
    expect(extractDates('Yargı sistemi: 2024-09-01').map((h) => h.iso)).toEqual(['2024-09-01']);
  });

  it('drops implausible dates silently', () => {
    expect(extractDates('Tarih 99.99.9999 yok.').length).toBe(0);
  });

  it('returns hits in source order', () => {
    const hits = extractDates('Önce 5/4/2024, sonra 1/4/2024.');
    expect(hits[0].raw).toBe('5/4/2024');
    expect(hits[1].raw).toBe('1/4/2024');
  });
});

describe('dava-tools · buildKronoloji + kronolojiToCsv', () => {
  it('flattens dated mentions across docs and sorts chronologically', () => {
    const docs = [
      doc('A', 'olay-tutanagi.md', '17 Mart 2024 günü olayın gerçekleştiği iddia edilmiştir.'),
      doc('B', 'durusma-tutanagi.md', 'Duruşma 02.05.2024 tarihinde yapıldı.'),
      doc('C', 'on-bilgi.md', 'İlk başvuru 2024-01-15 tarihinde alınmıştır.'),
    ];
    const k = buildKronoloji(docs);
    expect(k.map((e) => e.iso)).toEqual(['2024-01-15', '2024-03-17', '2024-05-02']);
    expect(k[0].docTitle).toBe('on-bilgi.md');
    expect(k[0].context).toContain('İlk başvuru');
  });

  it('emits a UTF-8 BOM and quotes cells with commas', () => {
    const csv = kronolojiToCsv([
      {
        iso: '2024-03-17',
        raw: '17 Mart 2024',
        docId: 'A',
        docTitle: 'olay, tutanağı.md',
        context: 'olayın "tarihi" 17 Mart 2024',
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"olay, tutanağı.md"');
    expect(csv).toContain('"olayın ""tarihi"" 17 Mart 2024"');
  });
});

describe('dava-tools · imtiyaz log', () => {
  const docs = [
    doc('A', 'sözleşme.md', '', { tint: 'violet' }),
    doc('B', 'kamu-belge.md', '', { tint: 'cyan' }),
    doc('C', 'taslak-dilekce.md', '', { tint: 'amber' }),
    doc('D', 'rose-doc.md', '', { tint: 'rose' }),
  ];
  const labels = {
    cyan: 'Halka Açık',
    amber: 'İş Ürünü',
    violet: 'Müvekkil–Avukat Gizli',
    rose: 'Etiketli',
  } as const;

  it('orders by privilege rank: violet → amber → cyan → rose', () => {
    const rows = buildImtiyazLog(docs, labels);
    expect(rows.map((r) => r.docTitle)).toEqual([
      'sözleşme.md',
      'taslak-dilekce.md',
      'kamu-belge.md',
      'rose-doc.md',
    ]);
  });

  it('CSV header is in Turkish and rows carry localized labels', () => {
    const rows = buildImtiyazLog(docs, labels);
    const csv = imtiyazLogToCsv(rows);
    expect(csv).toContain('Sınıf,Belge,Son güncelleme,Belge kimliği');
    expect(csv).toContain('Müvekkil–Avukat Gizli');
  });
});

describe('dava-tools · extractTanikList', () => {
  it('finds explicit Tanık: lines and dedupes within a doc', () => {
    const docs = [
      doc('A', 'celsel-1.md', '- Tanık: Ahmet Yılmaz\n- Tanık adı: Mehmet Öz\n  Tanık: Ahmet Yılmaz'),
      doc('B', 'celsel-2.md', 'Tanık - Ayşe Kara'),
    ];
    const hits = extractTanikList(docs);
    expect(hits.map((h) => `${h.docId}:${h.name}`).sort()).toEqual([
      'A:Ahmet Yılmaz',
      'A:Mehmet Öz',
      'B:Ayşe Kara',
    ]);
  });

  it('returns [] when no explicit witness lines exist', () => {
    expect(extractTanikList([doc('A', 'a.md', 'Sözleşme metni burada.')])).toEqual([]);
  });
});

describe('dava-tools · extractIctihat', () => {
  it('parses Yargıtay Hukuk Dairesi citations', () => {
    const hits = extractIctihat('Bkz. Yargıtay 11. Hukuk Dairesi, E. 2024/123, K. 2024/456 sayılı karar.');
    expect(hits).toHaveLength(1);
    expect(hits[0].ref).toEqual({
      court: 'yargitay',
      daire: 11,
      esas: '2024/123',
      karar: '2024/456',
    });
  });

  it('parses Danıştay citations', () => {
    const hits = extractIctihat('Danıştay 5. Daire, E. 2023/12, K. 2023/890 kararı.');
    expect(hits[0].ref.court).toBe('danistay');
    expect(hits[0].ref.daire).toBe(5);
  });

  it('parses AYM full E./K. form and Başvuru No form', () => {
    const hits = extractIctihat('AYM, E. 2022/1, K. 2023/2; ayrıca AYM Başvuru No 2024/777.');
    const courts = hits.map((h) => h.ref.court);
    expect(courts.every((c) => c === 'aym')).toBe(true);
    expect(hits.length).toBe(2);
  });

  it('refKey is stable + collision-free across courts', () => {
    const a = refKey({ court: 'yargitay', daire: 11, esas: '2024/123', karar: '2024/456' });
    const b = refKey({ court: 'danistay', daire: 11, esas: '2024/123', karar: '2024/456' });
    expect(a).not.toBe(b);
    expect(a).toBe(refKey({ court: 'yargitay', daire: 11, esas: '2024/123', karar: '2024/456' }));
  });
});

describe('dava-tools · ictihatCoCitationEdges', () => {
  it('connects two docs that share a citation', () => {
    const docs = [
      doc('A', 'a.md', 'Yargıtay 11. Hukuk Dairesi, E. 2024/123, K. 2024/456 emsali.'),
      doc('B', 'b.md', 'Yargıtay 11. Hukuk Dairesi, E. 2024/123, K. 2024/456 dayanağı.'),
      doc('C', 'c.md', 'Yargıtay 11. Hukuk Dairesi, E. 2020/1, K. 2020/2 farklı.'),
    ];
    const hits = extractIctihatAcrossVault(docs);
    const edges = ictihatCoCitationEdges(hits);
    expect(edges).toHaveLength(1);
    const [a, b] = edges[0];
    expect([a, b].sort()).toEqual(['A', 'B']);
  });

  it('emits no edge when a citation appears in only one doc', () => {
    const docs = [doc('A', 'a.md', 'Yargıtay 11. Hukuk Dairesi, E. 2024/1, K. 2024/2.')];
    expect(ictihatCoCitationEdges(extractIctihatAcrossVault(docs))).toEqual([]);
  });
});
