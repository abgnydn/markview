import { db } from '@/lib/storage/db';
import { renderMarkdown } from '@/lib/markdown/pipeline';

/**
 * Export a workspace as a self-contained static HTML site with navigation sidebar.
 * Generates an HTML file per markdown file + index.html with sidebar, packaged as .zip.
 */
export async function downloadAsStaticSite(
  workspaceId: string,
  title: string,
  theme: 'dark' | 'light'
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const files = await db.files
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();

  if (files.length === 0) return;

  const isDark = theme === 'dark';
  const colors = isDark
    ? { bg: '#0d1117', sidebar: '#161b22', text: '#e6edf3', muted: '#8b949e', border: '#30363d', link: '#58a6ff', active: 'rgba(88,166,255,0.1)', code: '#161b22' }
    : { bg: '#ffffff', sidebar: '#f6f8fa', text: '#1f2328', muted: '#656d76', border: '#d0d7de', link: '#0969da', active: 'rgba(9,105,218,0.08)', code: '#f6f8fa' };

  const siteFolder = zip.folder(title) || zip;

  // Generate HTML for each file
  const pages: { filename: string; htmlFilename: string; content: string }[] = [];
  for (const file of files) {
    const html = await renderMarkdown(file.content);
    const htmlFilename = file.filename.replace(/\.md$/i, '.html');
    pages.push({ filename: file.filename, htmlFilename, content: html });
  }

  // CSS
  const css = buildSiteCss(colors);
  siteFolder.file('style.css', css);

  // Build each page
  for (const page of pages) {
    const sidebar = buildSidebar(pages, page.htmlFilename);
    const fullHtml = buildPageHtml(page.filename.replace(/\.md$/i, ''), page.content, sidebar, title);
    siteFolder.file(page.htmlFilename, fullHtml);
  }

  // Index.html → redirect to first file
  if (pages.length > 0) {
    const indexHtml = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${pages[0].htmlFilename}"></head><body></body></html>`;
    siteFolder.file('index.html', indexHtml);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `${title}-site.zip`);
}

function buildSidebar(
  pages: { filename: string; htmlFilename: string }[],
  currentPage: string
): string {
  return pages
    .map((p) => {
      const isActive = p.htmlFilename === currentPage;
      const name = p.filename.replace(/\.md$/i, '');
      return `<a href="${p.htmlFilename}" class="nav-item${isActive ? ' active' : ''}">${name}</a>`;
    })
    .join('\n');
}

function buildPageHtml(pageTitle: string, bodyHtml: string, sidebarHtml: string, siteTitle: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle} — ${siteTitle}</title>
<link rel="stylesheet" href="style.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
<aside class="sidebar">
  <div class="sidebar-title">${siteTitle}</div>
  <nav>${sidebarHtml}</nav>
</aside>
<main class="content">
  ${bodyHtml}
</main>
</body>
</html>`;
}

function buildSiteCss(c: Record<string, string>): string {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: ${c.bg}; color: ${c.text}; display: flex; min-height: 100vh;
}
.sidebar {
  width: 260px; background: ${c.sidebar}; border-right: 1px solid ${c.border};
  padding: 20px 16px; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto;
}
.sidebar-title {
  font-size: 14px; font-weight: 700; color: ${c.text}; margin-bottom: 16px;
  padding-bottom: 12px; border-bottom: 1px solid ${c.border};
}
.nav-item {
  display: block; padding: 6px 12px; margin: 2px 0; border-radius: 6px;
  font-size: 13px; color: ${c.muted}; text-decoration: none; transition: all 0.15s;
}
.nav-item:hover { background: ${c.active}; color: ${c.text}; }
.nav-item.active { background: ${c.active}; color: ${c.link}; font-weight: 600; }
.content {
  margin-left: 260px; padding: 40px 48px; max-width: 840px; flex: 1;
  font-size: 16px; line-height: 1.7;
}
h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.6em; font-weight: 600; }
h1 { font-size: 2em; border-bottom: 1px solid ${c.border}; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid ${c.border}; padding-bottom: 0.3em; }
a { color: ${c.link}; text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: 'JetBrains Mono', monospace; font-size: 0.875em; background: ${c.code}; padding: 0.15em 0.4em; border-radius: 4px; }
pre { padding: 16px 20px; background: ${c.code}; border: 1px solid ${c.border}; border-radius: 12px; overflow-x: auto; margin: 1em 0; }
pre code { background: none; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 1em 0; }
th, td { padding: 10px 16px; border: 1px solid ${c.border}; text-align: left; }
th { background: ${c.sidebar}; font-weight: 600; }
blockquote { border-left: 4px solid ${c.border}; padding: 8px 16px; margin: 1em 0; color: ${c.muted}; }
ul, ol { padding-left: 2em; margin-bottom: 1em; }
li { margin-bottom: 0.35em; }
img { max-width: 100%; border-radius: 8px; }
hr { border: none; border-top: 1px solid ${c.border}; margin: 2em 0; }
@media (max-width: 768px) {
  .sidebar { display: none; }
  .content { margin-left: 0; padding: 20px; }
}
`;
}

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
