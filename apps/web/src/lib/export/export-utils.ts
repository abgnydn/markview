import { db } from '@/lib/storage/db';
import { renderMarkdown } from '@/lib/markdown/pipeline';

// ---------- Copy to Clipboard ----------

export async function copyAsMarkdown(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}

export async function copyAsHtml(content: string): Promise<void> {
  const html = await renderMarkdown(content);
  const styledHtml = wrapWithInlineStyles(html);

  const blob = new Blob([styledHtml], { type: 'text/html' });
  const textBlob = new Blob([content], { type: 'text/plain' });

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': blob,
      'text/plain': textBlob,
    }),
  ]);
}

// ---------- Download Files ----------

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, filename);
}

export async function downloadWorkspaceZip(workspaceId: string, title: string): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const files = await db.files
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();

  const folder = zip.folder(title) || zip;
  for (const file of files) {
    folder.file(file.filename, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `${title}.zip`);
}

export async function downloadAsHtml(
  filename: string,
  content: string,
  theme: 'dark' | 'light'
): Promise<void> {
  const html = await renderMarkdown(content);
  const title = filename.replace(/\.md$/i, '');
  const fullHtml = buildSelfContainedHtml(title, html, theme);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${title}.html`);
}

export function printDocument(): void {
  window.print();
}

// ---------- Helpers ----------

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function wrapWithInlineStyles(html: string): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #1f2328;">${html}</div>`;
}

function buildSelfContainedHtml(title: string, bodyHtml: string, theme: 'dark' | 'light'): string {
  const isDark = theme === 'dark';

  const colors = isDark
    ? {
        bg: '#0d1117', bgSec: '#161b22', bgEl: '#21262d',
        text: '#e6edf3', textSec: '#8b949e', textMuted: '#6e7681', textLink: '#58a6ff',
        border: '#30363d', borderMuted: '#21262d',
        accent: '#58a6ff', hover: 'rgba(255,255,255,0.05)',
        noteB: 'rgba(56,139,253,0.4)', noteBg: 'rgba(56,139,253,0.1)', noteT: '#58a6ff',
        tipB: 'rgba(46,160,67,0.4)', tipBg: 'rgba(46,160,67,0.1)', tipT: '#3fb950',
        impB: 'rgba(137,87,229,0.4)', impBg: 'rgba(137,87,229,0.1)', impT: '#bc8cff',
        warnB: 'rgba(187,128,9,0.4)', warnBg: 'rgba(187,128,9,0.1)', warnT: '#d29922',
        cautB: 'rgba(248,81,73,0.4)', cautBg: 'rgba(248,81,73,0.1)', cautT: '#f85149',
      }
    : {
        bg: '#ffffff', bgSec: '#f6f8fa', bgEl: '#ffffff',
        text: '#1f2328', textSec: '#656d76', textMuted: '#8b949e', textLink: '#0969da',
        border: '#d0d7de', borderMuted: '#d8dee4',
        accent: '#0969da', hover: 'rgba(0,0,0,0.04)',
        noteB: 'rgba(56,139,253,0.4)', noteBg: 'rgba(56,139,253,0.08)', noteT: '#0969da',
        tipB: 'rgba(46,160,67,0.4)', tipBg: 'rgba(46,160,67,0.08)', tipT: '#1a7f37',
        impB: 'rgba(137,87,229,0.4)', impBg: 'rgba(137,87,229,0.08)', impT: '#8250df',
        warnB: 'rgba(187,128,9,0.4)', warnBg: 'rgba(187,128,9,0.08)', warnT: '#9a6700',
        cautB: 'rgba(248,81,73,0.4)', cautBg: 'rgba(248,81,73,0.08)', cautT: '#d1242f',
      };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — MarkView</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: ${colors.text};
    background: ${colors.bg};
    max-width: 840px;
    margin: 0 auto;
    padding: 40px 32px;
  }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em; margin-bottom: 0.6em;
    font-weight: 600; line-height: 1.3; color: ${colors.text};
  }
  h1 { font-size: 2em; border-bottom: 1px solid ${colors.borderMuted}; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid ${colors.borderMuted}; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }

  p { margin-bottom: 1em; }
  a { color: ${colors.textLink}; text-decoration: none; }
  a:hover { text-decoration: underline; }
  strong { font-weight: 600; }

  ul, ol { margin-bottom: 1em; padding-left: 2em; }
  li { margin-bottom: 0.35em; }

  blockquote {
    margin: 1em 0; padding: 0.5em 1em;
    border-left: 4px solid ${colors.border};
    color: ${colors.textSec}; background: ${colors.hover};
    border-radius: 0 6px 6px 0;
  }

  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875em; background: ${colors.bgEl};
    padding: 0.15em 0.4em; border-radius: 4px;
    border: 1px solid ${colors.borderMuted};
  }
  pre code { background: none; padding: 0; border: none; }
  pre {
    margin: 1em 0; padding: 16px 20px;
    background: ${colors.bgSec}; border: 1px solid ${colors.border};
    border-radius: 12px; overflow-x: auto; line-height: 1.6;
  }

  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 14px; }
  thead th { background: ${colors.bgSec}; font-weight: 600; text-align: left; padding: 10px 16px; border: 1px solid ${colors.border}; }
  tbody td { padding: 10px 16px; border: 1px solid ${colors.border}; }
  tbody tr:nth-child(even) { background: ${colors.hover}; }

  hr { border: none; border-top: 1px solid ${colors.border}; margin: 2em 0; }

  img { max-width: 100%; border-radius: 8px; }

  input[type="checkbox"] { margin-right: 8px; accent-color: ${colors.accent}; }

  .markdown-alert {
    margin: 1em 0; padding: 12px 16px;
    border-radius: 6px; border-left: 4px solid;
  }
  .markdown-alert-note { border-color: ${colors.noteB}; background: ${colors.noteBg}; }
  .markdown-alert-tip { border-color: ${colors.tipB}; background: ${colors.tipBg}; }
  .markdown-alert-important { border-color: ${colors.impB}; background: ${colors.impBg}; }
  .markdown-alert-warning { border-color: ${colors.warnB}; background: ${colors.warnBg}; }
  .markdown-alert-caution { border-color: ${colors.cautB}; background: ${colors.cautBg}; }
  .markdown-alert-title {
    font-weight: 600; font-size: 14px; margin-bottom: 4px;
    display: flex; align-items: center; gap: 6px;
  }
  .markdown-alert-note .markdown-alert-title { color: ${colors.noteT}; }
  .markdown-alert-tip .markdown-alert-title { color: ${colors.tipT}; }
  .markdown-alert-important .markdown-alert-title { color: ${colors.impT}; }
  .markdown-alert-warning .markdown-alert-title { color: ${colors.warnT}; }
  .markdown-alert-caution .markdown-alert-title { color: ${colors.cautT}; }

  footer {
    margin-top: 60px; padding-top: 16px;
    border-top: 1px solid ${colors.border};
    font-size: 12px; color: ${colors.textMuted}; text-align: center;
  }

  @media print {
    body { padding: 0; max-width: none; }
    footer { display: none; }
  }
</style>
</head>
<body>
${bodyHtml}
<footer>Exported from MarkView</footer>
</body>
</html>`;
}
