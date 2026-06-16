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

/** Save a Blob to disk via a transient object-URL anchor click. Shared by
 *  every export module so there's one definition of the download dance. */
export function triggerDownload(blob: Blob, filename: string): void {
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

  // MarkView's own identity — reading-dark + antique-cream, violet accent.
  const colors = isDark
    ? {
        bg: '#0d0e13', bgSec: '#16181f', bgEl: '#1c1f27',
        text: '#eef1f6', textSec: '#aeb6c4', textMuted: '#7d8595', textLink: '#9b7dff',
        border: '#2a2d36', borderMuted: '#20232b',
        accent: '#9b7dff', hover: 'rgba(255,255,255,0.04)',
        noteB: 'rgba(155,125,255,0.45)', noteBg: 'rgba(155,125,255,0.1)', noteT: '#b9a3ff',
        tipB: 'rgba(70,185,138,0.45)', tipBg: 'rgba(70,185,138,0.1)', tipT: '#5fd0a0',
        impB: 'rgba(155,125,255,0.45)', impBg: 'rgba(155,125,255,0.1)', impT: '#b9a3ff',
        warnB: 'rgba(224,137,74,0.45)', warnBg: 'rgba(224,137,74,0.1)', warnT: '#e0a05a',
        cautB: 'rgba(214,90,90,0.45)', cautBg: 'rgba(214,90,90,0.1)', cautT: '#e07b7b',
      }
    : {
        bg: '#fbf8f1', bgSec: '#f1ece0', bgEl: '#f6f1e6',
        text: '#2b2118', textSec: '#6b5d49', textMuted: '#9a8c74', textLink: '#6d3bd0',
        border: '#e0d6c2', borderMuted: '#ebe3d2',
        accent: '#6d3bd0', hover: 'rgba(70,50,25,0.04)',
        noteB: 'rgba(109,59,208,0.4)', noteBg: 'rgba(109,59,208,0.07)', noteT: '#5b2bd6',
        tipB: 'rgba(38,128,55,0.4)', tipBg: 'rgba(38,128,55,0.07)', tipT: '#1a7f37',
        impB: 'rgba(109,59,208,0.4)', impBg: 'rgba(109,59,208,0.07)', impT: '#5b2bd6',
        warnB: 'rgba(154,103,0,0.4)', warnBg: 'rgba(154,103,0,0.07)', warnT: '#9a6700',
        cautB: 'rgba(192,56,58,0.4)', cautBg: 'rgba(192,56,58,0.07)', cautT: '#c0383a',
      };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — MarkView</title>
<style>
  /* System font stack — no external dependencies. */
  :root {
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    --font-serif: 'Iowan Old Style', 'Charter', 'Palatino', Georgia, 'Times New Roman', serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--font-sans);
    font-size: 17px;
    line-height: 1.75;
    color: ${colors.text};
    background: ${colors.bg};
    max-width: 720px;
    margin: 0 auto;
    padding: 72px 28px 96px;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-serif);
    margin-top: 1.6em; margin-bottom: 0.5em;
    font-weight: 700; line-height: 1.15; letter-spacing: -0.015em; color: ${colors.text};
  }
  h1 { font-size: 2.4em; margin-top: 0; }
  h1::after { content: ''; display: block; width: 64px; height: 3px; margin-top: 0.35em; border-radius: 2px; background: linear-gradient(90deg, ${colors.accent}, transparent); }
  h2 { font-size: 1.7em; }
  h3 { font-size: 1.32em; }
  h4 { font-size: 1.08em; }

  p { margin-bottom: 1em; }
  a { color: ${colors.textLink}; text-decoration: none; border-bottom: 1px solid transparent; transition: border-color 0.15s; }
  a:hover { border-bottom-color: ${colors.textLink}; }
  strong { font-weight: 700; }

  ul, ol { margin-bottom: 1em; padding-left: 1.5em; }
  li { margin-bottom: 0.4em; }

  blockquote {
    margin: 1.2em 0; padding: 0.3em 0 0.3em 1.1em;
    border-left: 3px solid ${colors.accent};
    color: ${colors.textSec}; font-style: italic;
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
