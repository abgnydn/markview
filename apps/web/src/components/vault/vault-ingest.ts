'use client';

// Browser-side ingest for the vault. KVKK posture: every parser runs in the
// user's browser — no upload, no server round-trip. A dropped .docx/.pdf is
// turned into a markdown note locally, then fed into the same semantic graph
// as hand-written notes.
//
// The Node-only `pdf-parse` used in apps/context-vault is replaced here by
// `pdfjs-dist`'s browser build, which is the upstream library pdf-parse wraps.

const SUPPORTED_EXTS = new Set(['.md', '.txt', '.docx', '.pdf', '.xlsx', '.xls', '.csv', '.udf']);

export type IngestKind = 'md' | 'txt' | 'docx' | 'pdf' | 'xlsx' | 'csv' | 'udf';

export interface IngestResult {
  title: string;
  content: string;
  kind: IngestKind;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

export function isIngestable(file: File): boolean {
  return SUPPORTED_EXTS.has(extOf(file.name));
}

export const INGEST_ACCEPT = '.md,.txt,.docx,.pdf,.xlsx,.xls,.csv,.udf';

function baseTitle(name: string): string {
  const ext = extOf(name);
  const stem = ext ? name.slice(0, -ext.length) : name;
  return `${stem.trim() || 'imported'}.md`;
}

function asParagraphs(raw: string): string {
  // Collapse runs of blank lines to exactly one blank line, trim trailing
  // whitespace per line. Enough structure for markdown without faking any.
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[\t ]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wrapAsMarkdown(title: string, body: string): string {
  const header = `# ${title.replace(/\.md$/i, '')}`;
  return body ? `${header}\n\n${body}\n` : `${header}\n`;
}

async function parseTextLike(file: File): Promise<string> {
  return await file.text();
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = (await import('mammoth')).default as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

async function parseSpreadsheet(file: File): Promise<string> {
  // xlsx's main export is a namespace object with `read`, `utils`, etc.
  const xlsx = await import('xlsx');
  const XLSX = (xlsx as unknown as {
    read: (data: ArrayBuffer, opts: { type: 'array' }) => {
      SheetNames: string[];
      Sheets: Record<string, unknown>;
    };
    utils: {
      sheet_to_csv: (sheet: unknown) => string;
    };
  });
  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    parts.push(`## ${name}\n\n\`\`\`csv\n${csv.trim()}\n\`\`\``);
  }
  return parts.join('\n\n');
}

// ─── UYAP .udf ──────────────────────────────────────────────────────────────
// Format: plain ZIP containing content.xml (RTF wrapped in XML), optional
// metadata.xml, optional PKCS7 signature blob. Reimplemented from the public
// format spec (dev.to writeup by ox3adie1) — no code borrowed from closed /
// license-unclear OSS parsers. Signature verification is out of scope for MVP;
// we parse the content, ignore the cryptographic envelope.
//
// RTF→text strategy: we want the legal-doc *text*, not formatting. Strip
// groups/control-words, decode unicode escapes (\u#### with optional fallback
// char), preserve paragraph breaks (\par, \line). Hex escapes (\'XX) decoded
// as Windows-1254 (UYAP's legacy default) with a UTF-8 fallback.

function decodeRtfUnicode(n: number): string {
  // \u can emit signed 16-bit values; legacy RTF negative ints = unsigned + 65536.
  if (n < 0) n += 65536;
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

// Windows-1254 (Turkish) — positions 0x80–0xFF that differ from Latin-1.
// Everything else maps 1:1 to Unicode, so we only table the deltas.
const CP1254_MAP: Record<number, number> = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
  0x8B: 0x2039, 0x8C: 0x0152, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C,
  0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC,
  0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9F: 0x0178,
  0xD0: 0x011E, 0xDD: 0x0130, 0xDE: 0x015E, 0xF0: 0x011F, 0xFD: 0x0131,
  0xFE: 0x015F,
};

function decodeCp1254Byte(b: number): string {
  if (b < 0x80) return String.fromCharCode(b);
  const mapped = CP1254_MAP[b];
  return mapped ? String.fromCodePoint(mapped) : String.fromCharCode(b);
}

/** Minimal RTF → plain-text extractor. Strips control-words & groups, keeps
 *  text runs, honours unicode/hex escapes, emits newlines for \par/\line. */
export function rtfToText(rtf: string): string {
  let out = '';
  let i = 0;
  const n = rtf.length;
  let depth = 0;
  // Skip content of destinations that aren't visible text: fonttbl, colortbl,
  // stylesheet, info, pict, etc. Track the enclosing group depth when we enter.
  let skipDepth = -1;

  while (i < n) {
    const c = rtf[i];

    if (c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      if (skipDepth >= 0 && depth <= skipDepth) skipDepth = -1;
      depth--;
      i++;
      continue;
    }
    if (c === '\\') {
      // Control: could be \\word[number], \u####, \'XX, \*, or literal escape.
      const next = rtf[i + 1];
      if (next === '\\' || next === '{' || next === '}') {
        if (skipDepth < 0) out += next;
        i += 2;
        continue;
      }
      if (next === '*') {
        // \*\destination — the following destination is non-visible; skip.
        // We only strip the marker and let the next control-word apply.
        i += 2;
        continue;
      }
      if (next === "'") {
        // Hex escape: \'XX
        const hex = rtf.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          if (skipDepth < 0) out += decodeCp1254Byte(parseInt(hex, 16));
          i += 4;
          continue;
        }
        i += 2;
        continue;
      }
      // Control word: \word[-]?[0-9]* optionally followed by a space.
      const m = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)?(\s?)/);
      if (m) {
        const word = m[1];
        const arg = m[2];
        const delim = m[3];
        const hadSpace = delim === ' ';
        const consumed = 1 + m[0].length;

        if (skipDepth < 0) {
          if (word === 'par' || word === 'line' || word === 'sect') {
            // Paragraph markers emit a newline. When the author put a space
            // after \par (its delimiter), preserve it as leading whitespace
            // of the next line so word boundaries survive RTF extraction.
            out += '\n';
            if (hadSpace) out += ' ';
          } else if (word === 'tab') {
            out += '\t';
          } else if (word === 'u' && arg !== undefined) {
            out += decodeRtfUnicode(parseInt(arg, 10));
            // Skip the fallback char (1 char by default, overridden by \uc).
            if (rtf[i + consumed] === '?') i++;
          } else if (
            word === 'fonttbl' || word === 'colortbl' ||
            word === 'stylesheet' || word === 'info' ||
            word === 'pict' || word === 'filetbl' ||
            word === 'themedata' || word === 'listtable' ||
            word === 'revtbl' || word === 'generator'
          ) {
            skipDepth = depth;
          } else if (hadSpace && out.length > 0 && !/\s$/.test(out)) {
            // Formatting-only control word (\b, \i, \b0, …) whose delimiter
            // space was consumed between two text runs. Re-emit the space
            // so word boundaries survive.
            out += ' ';
          }
        }
        i += consumed;
        continue;
      }
      // Lone backslash at eof
      i++;
      continue;
    }

    // Plain character (or whitespace)
    if (skipDepth < 0) {
      // RTF uses \par for paragraphs; bare newlines in the source are just
      // formatting of the RTF file itself and should be treated as space.
      if (c === '\n' || c === '\r') out += ' ';
      else out += c;
    }
    i++;
  }

  return out;
}

async function parseUdf(file: File): Promise<string> {
  const jszip = await import('jszip');
  const JSZip = (jszip as unknown as {
    default?: { loadAsync: (data: ArrayBuffer) => Promise<ZipLike> };
    loadAsync?: (data: ArrayBuffer) => Promise<ZipLike>;
  });
  const loader = JSZip.default ?? (JSZip as { loadAsync: (d: ArrayBuffer) => Promise<ZipLike> });
  const buffer = await file.arrayBuffer();
  const zip = await loader.loadAsync(buffer);
  const contentEntry = zip.file('content.xml');
  if (!contentEntry) {
    throw new Error('UDF: content.xml missing — not a valid UYAP document');
  }
  const xmlString = await contentEntry.async('string');

  // Pull the RTF payload out of <content>…</content>. The UYAP schema stores
  // it as the text node (sometimes CDATA-wrapped) of a single <content> elem.
  const contentMatch = xmlString.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  let rtf = contentMatch ? contentMatch[1] : '';
  // Strip CDATA wrapper if present.
  rtf = rtf.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
  // Unescape common XML entities that would otherwise confuse the RTF parser.
  rtf = rtf
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  const text = rtfToText(rtf);
  return text;
}

interface ZipLike {
  file: (name: string) => { async: (kind: 'string') => Promise<string> } | null;
}

let pdfWorkerConfigured = false;
async function ensurePdfWorker(pdfjs: {
  GlobalWorkerOptions: { workerPort?: Worker | null; workerSrc?: string };
}): Promise<void> {
  if (pdfWorkerConfigured) return;
  pdfWorkerConfigured = true;
  // Bundler-resolved worker URL — keeps everything local (no CDN hit) and
  // works in Webpack and Turbopack alike. We hand pdfjs a live Worker via
  // workerPort so the library skips its own loader path.
  const workerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  );
  try {
    const worker = new Worker(workerUrl, { type: 'module' });
    pdfjs.GlobalWorkerOptions.workerPort = worker;
  } catch {
    // Fallback: let pdfjs fetch the worker itself from the same URL.
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.toString();
  }
}

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  await ensurePdfWorker(pdfjs as unknown as {
    GlobalWorkerOptions: { workerPort?: Worker | null; workerSrc?: string };
  });
  const data = await file.arrayBuffer();
  const loadingTask = (pdfjs as unknown as {
    getDocument: (args: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
  }).getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    // pdfjs returns `items: Array<{ str: string; hasEOL?: boolean }>`.
    // Concatenate with spaces; break lines on EOL hints so paragraphs survive.
    const line: string[] = [];
    const out: string[] = [];
    for (const it of tc.items) {
      const item = it as { str?: string; hasEOL?: boolean };
      if (typeof item.str === 'string') line.push(item.str);
      if (item.hasEOL) {
        out.push(line.join(' ').trim());
        line.length = 0;
      }
    }
    if (line.length) out.push(line.join(' ').trim());
    pages.push(out.filter(Boolean).join('\n'));
  }
  return pages.join('\n\n');
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
}

export async function parseFile(file: File): Promise<IngestResult | null> {
  const ext = extOf(file.name);
  if (!SUPPORTED_EXTS.has(ext)) return null;

  const title = baseTitle(file.name);

  if (ext === '.md' || ext === '.txt') {
    const raw = await parseTextLike(file);
    // Markdown files come through verbatim so their own headings survive.
    // Plain text gets wrapped with a title header.
    if (ext === '.md') {
      const body = asParagraphs(raw);
      return {
        title,
        content: body ? `${body}\n` : wrapAsMarkdown(title, ''),
        kind: 'md',
      };
    }
    return {
      title,
      content: wrapAsMarkdown(title, asParagraphs(raw)),
      kind: 'txt',
    };
  }

  if (ext === '.docx') {
    const raw = await parseDocx(file);
    return {
      title,
      content: wrapAsMarkdown(title, asParagraphs(raw)),
      kind: 'docx',
    };
  }

  if (ext === '.pdf') {
    const raw = await parsePdf(file);
    return {
      title,
      content: wrapAsMarkdown(title, asParagraphs(raw)),
      kind: 'pdf',
    };
  }

  if (ext === '.xlsx' || ext === '.xls') {
    const raw = await parseSpreadsheet(file);
    return {
      title,
      // Spreadsheet path already emits per-sheet headers; wrap with a doc H1.
      content: `# ${title.replace(/\.md$/i, '')}\n\n${raw}\n`,
      kind: 'xlsx',
    };
  }

  if (ext === '.csv') {
    const raw = await parseTextLike(file);
    return {
      title,
      content: `# ${title.replace(/\.md$/i, '')}\n\n\`\`\`csv\n${raw.trim()}\n\`\`\`\n`,
      kind: 'csv',
    };
  }

  if (ext === '.udf') {
    const raw = await parseUdf(file);
    return {
      title,
      content: wrapAsMarkdown(title, asParagraphs(raw)),
      kind: 'udf',
    };
  }

  return null;
}

export async function parseFiles(
  files: File[] | FileList,
): Promise<{ results: IngestResult[]; skipped: File[] }> {
  const list = Array.from(files);
  const results: IngestResult[] = [];
  const skipped: File[] = [];
  for (const file of list) {
    if (!isIngestable(file)) {
      skipped.push(file);
      continue;
    }
    try {
      const res = await parseFile(file);
      if (res) results.push(res);
      else skipped.push(file);
    } catch (err) {
      console.warn('[vault-ingest] failed to parse', file.name, err);
      skipped.push(file);
    }
  }
  return { results, skipped };
}
