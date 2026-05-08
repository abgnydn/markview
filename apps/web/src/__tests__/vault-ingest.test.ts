// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

// We mock both heavyweight parsers so the test is pure-CPU and doesn't try
// to spin up a pdfjs worker or unzip a real .docx.
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(async () => ({
      value: 'docx paragraph one\n\ndocx paragraph two',
    })),
  },
}));

vi.mock('pdfjs-dist', () => {
  const getDocument = vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async (n: number) => ({
        getTextContent: async () => ({
          items: [
            { str: `page ${n} line A`, hasEOL: true },
            { str: `page ${n} line B`, hasEOL: true },
          ],
        }),
      }),
    }),
  }));
  return {
    GlobalWorkerOptions: {} as { workerPort?: Worker; workerSrc?: string },
    getDocument,
  };
});

vi.mock('xlsx', () => ({
  read: vi.fn(() => ({
    SheetNames: ['Sheet1', 'Davalar'],
    Sheets: {
      Sheet1: '__sheet1__',
      Davalar: '__davalar__',
    },
  })),
  utils: {
    sheet_to_csv: vi.fn((s: unknown) =>
      s === '__sheet1__' ? 'a,b,c\n1,2,3' : 'dosyano,tarih\n2024/123,2024-05-01',
    ),
  },
}));

// JSZip — return a fake zip whose content.xml is the RTF-in-XML UYAP payload.
// The UDF parser wraps \u#### Turkish escapes + a <content> XML element.
const FAKE_UDF_RTF = String.raw`{\rtf1\ansi\ansicpg1254\deff0
{\fonttbl{\f0 Times New Roman;}}
\f0\fs24
BOLU ADL\u304?YES\u304? \par
Dava No: 2024/123 \par
Davac\u305?: Ahmet Y\u305?lmaz \par
Dava Konusu: Trafik tazminat\u305? \par
\par
Taraflar a\u351?a\u287?\u305?dad\u305?r.}`;
const FAKE_UDF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <content><![CDATA[${FAKE_UDF_RTF}]]></content>
  <metadata><author>UYAP</author></metadata>
</document>`;

vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn(async () => ({
      file: (name: string) => {
        if (name === 'content.xml') {
          return { async: async () => FAKE_UDF_XML };
        }
        return null;
      },
    })),
  },
}));

import {
  isIngestable,
  extOf,
  parseFile,
  parseFiles,
  rtfToText,
} from '@/components/vault/vault-ingest';
import { importDocs } from '@/components/vault/vault-store';

function makeFile(name: string, body: string | ArrayBuffer, type = ''): File {
  return new File([body as BlobPart], name, { type });
}

describe('vault-ingest · extension classification', () => {
  it('extOf lowercases and isolates the extension', () => {
    expect(extOf('CASE.DOCX')).toBe('.docx');
    expect(extOf('brief.pdf')).toBe('.pdf');
    expect(extOf('no-extension')).toBe('');
    expect(extOf('archive.tar.gz')).toBe('.gz');
  });

  it('isIngestable accepts the supported extensions and rejects others', () => {
    expect(isIngestable(makeFile('a.md', ''))).toBe(true);
    expect(isIngestable(makeFile('a.txt', ''))).toBe(true);
    expect(isIngestable(makeFile('a.docx', new ArrayBuffer(0)))).toBe(true);
    expect(isIngestable(makeFile('a.pdf', new ArrayBuffer(0)))).toBe(true);
    expect(isIngestable(makeFile('a.xlsx', new ArrayBuffer(0)))).toBe(true);
    expect(isIngestable(makeFile('a.xls', new ArrayBuffer(0)))).toBe(true);
    expect(isIngestable(makeFile('a.csv', ''))).toBe(true);
    expect(isIngestable(makeFile('karar.udf', new ArrayBuffer(0)))).toBe(true);

    expect(isIngestable(makeFile('image.png', new ArrayBuffer(0)))).toBe(false);
    expect(isIngestable(makeFile('noext', ''))).toBe(false);
  });
});

describe('vault-ingest · parseFile', () => {
  it('passes .md through verbatim (title preserved, content kept)', async () => {
    const file = makeFile(
      'welcome.md',
      '# Welcome\n\nThis is a note.\n\n\n\nWith blanks.',
    );
    const res = await parseFile(file);
    expect(res).not.toBeNull();
    expect(res!.kind).toBe('md');
    expect(res!.title).toBe('welcome.md');
    // Existing heading must survive — we don't double-wrap.
    expect(res!.content).toContain('# Welcome');
    // Triple-blank runs are collapsed.
    expect(res!.content).not.toMatch(/\n{3,}/);
  });

  it('wraps .txt in a markdown header derived from the filename', async () => {
    const file = makeFile('notes.txt', 'plain text line one\nplain text line two');
    const res = await parseFile(file);
    expect(res!.kind).toBe('txt');
    expect(res!.title).toBe('notes.md');
    expect(res!.content.startsWith('# notes')).toBe(true);
    expect(res!.content).toContain('plain text line one');
  });

  it('ingests .docx via mammoth', async () => {
    const file = makeFile('brief.docx', new ArrayBuffer(8));
    const res = await parseFile(file);
    expect(res!.kind).toBe('docx');
    expect(res!.title).toBe('brief.md');
    expect(res!.content).toContain('docx paragraph one');
    expect(res!.content).toContain('docx paragraph two');
    expect(res!.content.startsWith('# brief')).toBe(true);
  });

  it('ingests .pdf via pdfjs with EOL-driven line breaks', async () => {
    const file = makeFile('matter.pdf', new ArrayBuffer(8));
    const res = await parseFile(file);
    expect(res!.kind).toBe('pdf');
    expect(res!.title).toBe('matter.md');
    // All four synthetic lines across two pages must land in the content.
    expect(res!.content).toContain('page 1 line A');
    expect(res!.content).toContain('page 1 line B');
    expect(res!.content).toContain('page 2 line A');
    expect(res!.content).toContain('page 2 line B');
  });

  it('ingests .xlsx via xlsx with one fenced code block per sheet', async () => {
    const file = makeFile('matters.xlsx', new ArrayBuffer(8));
    const res = await parseFile(file);
    expect(res!.kind).toBe('xlsx');
    expect(res!.title).toBe('matters.md');
    expect(res!.content).toContain('## Sheet1');
    expect(res!.content).toContain('## Davalar');
    expect(res!.content).toContain('```csv');
    expect(res!.content).toContain('a,b,c');
    expect(res!.content).toContain('dosyano,tarih');
  });

  it('ingests .csv by fencing the raw text', async () => {
    const file = makeFile('clients.csv', 'ad,soyad\nBaris,Gunaydin');
    const res = await parseFile(file);
    expect(res!.kind).toBe('csv');
    expect(res!.title).toBe('clients.md');
    expect(res!.content).toContain('# clients');
    expect(res!.content).toContain('```csv');
    expect(res!.content).toContain('Baris,Gunaydin');
  });

  it('ingests .udf — extracts RTF text and decodes Turkish unicode escapes', async () => {
    const file = makeFile('karar.udf', new ArrayBuffer(16));
    const res = await parseFile(file);
    expect(res).not.toBeNull();
    expect(res!.kind).toBe('udf');
    expect(res!.title).toBe('karar.md');
    // Unicode escapes decoded: \u304? → İ, \u305? → ı, \u351? → ş, \u287? → ğ
    expect(res!.content).toContain('BOLU ADLİYESİ');
    expect(res!.content).toContain('Ahmet Yılmaz');
    expect(res!.content).toContain('Trafik tazminatı');
    expect(res!.content).toContain('aşağıdadır');
    // Font table control group is skipped — must NOT leak into text.
    expect(res!.content).not.toContain('Times New Roman');
    expect(res!.content).not.toContain('\\fonttbl');
  });

  it('returns null for genuinely unsupported extensions', async () => {
    const file = makeFile('scanned.tiff', new ArrayBuffer(0));
    const res = await parseFile(file);
    expect(res).toBeNull();
  });
});

describe('rtfToText · RTF extractor unit tests', () => {
  it('strips control words and groups, keeps text runs', () => {
    const rtf = String.raw`{\rtf1\ansi hello \b world\b0 end}`;
    expect(rtfToText(rtf).trim()).toBe('hello world end');
  });

  it('converts \\par to newline and \\tab to tab', () => {
    const rtf = String.raw`{\rtf1 line one\par line two\tab col2}`;
    const out = rtfToText(rtf);
    expect(out).toContain('line one\n line two');
    expect(out).toContain('\tcol2');
  });

  it('decodes \\u#### unicode escapes (Turkish glyphs)', () => {
    // \u304 = İ (uppercase I with dot), \u305 = ı (lowercase dotless i)
    // \u287 = ğ, \u351 = ş
    const rtf = String.raw`{\rtf1 a\u304?b\u305?c\u287?d\u351?e}`;
    expect(rtfToText(rtf)).toContain('aİbıcğdşe');
  });

  it('decodes \\u with negative 16-bit values as unsigned', () => {
    // 0xFEFF - 65536 = -257. RTF emits that as \u-257
    const rtf = String.raw`{\rtf1 \u-257?X}`;
    expect(rtfToText(rtf)).toContain('﻿X');
  });

  it("decodes \\'XX as Windows-1254 (Turkish code page) bytes", () => {
    // 0xFD = ı, 0xDD = İ, 0xFE = ş, 0xDE = Ş in CP1254
    const rtf = String.raw`{\rtf1 a\'fdb\'ddc\'fed\'de}`;
    expect(rtfToText(rtf)).toContain('aıbİcşdŞ');
  });

  it('skips fonttbl / colortbl / stylesheet destinations entirely', () => {
    const rtf = String.raw`{\rtf1 {\fonttbl{\f0 Arial;}{\f1 Times;}}visible body}`;
    const out = rtfToText(rtf).trim();
    expect(out).toBe('visible body');
    expect(out).not.toContain('Arial');
    expect(out).not.toContain('Times');
  });

  it('handles escaped braces and backslashes as literals', () => {
    const rtf = String.raw`{\rtf1 keep \{literal\} text \\here}`;
    expect(rtfToText(rtf)).toContain('keep {literal} text \\here');
  });
});

describe('vault-ingest · parseFiles aggregates results', () => {
  it('splits into results + skipped and preserves input order of results', async () => {
    const files = [
      makeFile('a.md', '# A\n'),
      makeFile('b.png', new ArrayBuffer(0)), // unsupported → skipped
      makeFile('c.txt', 'c body'),
    ];
    const { results, skipped } = await parseFiles(files);
    expect(results.map((r) => r.title)).toEqual(['a.md', 'c.md']);
    expect(skipped.map((f) => f.name)).toEqual(['b.png']);
  });
});

describe('importDocs reducer · title collisions', () => {
  it('renames colliding titles with numeric suffixes', () => {
    const start = { name: 'V', docs: [] };
    const r1 = importDocs(start, [
      { title: 'brief.md', content: '# brief\n' },
      { title: 'brief.md', content: '# brief again\n' },
    ]);
    const titles = r1.state.docs.map((d) => d.title);
    expect(titles).toEqual(['brief.md', 'brief-2.md']);
    expect(r1.created.length).toBe(2);
  });
});
