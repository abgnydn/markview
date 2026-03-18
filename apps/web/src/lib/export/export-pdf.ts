import { renderMarkdown } from '@/lib/markdown/pipeline';

/**
 * Export the active markdown as a PDF file.
 * Uses html2pdf.js for client-side PDF generation with styled output.
 */
export async function downloadAsPdf(
  filename: string,
  content: string,
  theme: 'dark' | 'light'
): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const html = await renderMarkdown(content);
  const title = filename.replace(/\.md$/i, '');

  const isDark = theme === 'dark';
  const bg = isDark ? '#0d1117' : '#ffffff';
  const text = isDark ? '#e6edf3' : '#1f2328';
  const border = isDark ? '#30363d' : '#d0d7de';
  const codeBg = isDark ? '#161b22' : '#f6f8fa';

  // Create a temporary container with styling
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.cssText = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
    font-size: 14px; line-height: 1.7; color: ${text}; background: ${bg};
    padding: 20px; max-width: 100%;
  `;

  // Style code blocks
  container.querySelectorAll('pre').forEach((pre) => {
    (pre as HTMLElement).style.cssText = `
      background: ${codeBg}; padding: 12px 16px; border-radius: 8px;
      border: 1px solid ${border}; overflow-x: auto; font-size: 12px;
      line-height: 1.6; font-family: 'JetBrains Mono', monospace;
    `;
  });

  // Style tables
  container.querySelectorAll('table').forEach((table) => {
    (table as HTMLElement).style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13px;';
  });
  container.querySelectorAll('th, td').forEach((cell) => {
    (cell as HTMLElement).style.cssText = `padding: 8px 12px; border: 1px solid ${border}; text-align: left;`;
  });
  container.querySelectorAll('th').forEach((th) => {
    (th as HTMLElement).style.background = codeBg;
  });

  // Style blockquotes
  container.querySelectorAll('blockquote').forEach((bq) => {
    (bq as HTMLElement).style.cssText = `
      border-left: 4px solid ${border}; padding: 8px 16px;
      margin: 12px 0; color: ${isDark ? '#8b949e' : '#656d76'};
    `;
  });

  document.body.appendChild(container);

  const opt = {
    margin: [10, 10, 15, 10] as [number, number, number, number],
    filename: `${title}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: bg },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}
