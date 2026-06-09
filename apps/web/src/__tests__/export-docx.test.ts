// Verifies the DOCX builder preserves nested-list structure (a deeper
// indent per level) instead of flattening sub-lists into the parent line.

import { describe, it, expect } from 'vitest';
import { buildDocxDocument } from '@/lib/export/export-docx';

async function documentXml(content: string): Promise<string> {
  const { Packer } = await import('docx');
  const doc = await buildDocxDocument(content, 'test');
  const base64 = await Packer.toBase64String(doc);
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(base64, { base64: true });
  return zip.file('word/document.xml')!.async('string');
}

describe('buildDocxDocument', () => {
  it('indents nested list items one level deeper', async () => {
    const md = '- top\n  - nested\n    - deep';
    const xml = await documentXml(md);
    // docx renders Paragraph indent {left} as w:ind w:left="N".
    expect(xml).toContain('w:left="720"');   // level 0
    expect(xml).toContain('w:left="1440"');  // level 1 (nested)
    expect(xml).toContain('w:left="2160"');  // level 2 (deep)
    // All three items survive, not just the top one.
    expect(xml).toContain('top');
    expect(xml).toContain('nested');
    expect(xml).toContain('deep');
  });

  it('numbers ordered list items per level', async () => {
    const md = '1. one\n2. two';
    const xml = await documentXml(md);
    expect(xml).toContain('1. ');
    expect(xml).toContain('2. ');
  });
});
