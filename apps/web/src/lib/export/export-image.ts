/**
 * Export the rendered markdown view as an image (PNG or SVG).
 * Uses html-to-image to capture the rendered DOM node.
 */
export async function downloadAsImage(
  filename: string,
  format: 'png' | 'svg'
): Promise<void> {
  const htmlToImage = await import('html-to-image');
  const title = filename.replace(/\.md$/i, '');

  // Find the rendered markdown container
  const target = document.querySelector('.markdown-body') as HTMLElement;
  if (!target) throw new Error('No rendered markdown found');

  let dataUrl: string;
  if (format === 'svg') {
    dataUrl = await htmlToImage.toSvg(target, {
      backgroundColor: getComputedStyle(target).backgroundColor || '#0d1117',
      style: { padding: '20px' },
    });
  } else {
    dataUrl = await htmlToImage.toPng(target, {
      pixelRatio: 2,
      backgroundColor: getComputedStyle(target).backgroundColor || '#0d1117',
      style: { padding: '20px' },
    });
  }

  const link = document.createElement('a');
  link.download = `${title}.${format}`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copy the rendered markdown view as a PNG image to clipboard.
 */
export async function copyAsImage(): Promise<void> {
  const htmlToImage = await import('html-to-image');

  const target = document.querySelector('.markdown-body') as HTMLElement;
  if (!target) throw new Error('No rendered markdown found');

  const blob = await htmlToImage.toBlob(target, {
    pixelRatio: 2,
    backgroundColor: getComputedStyle(target).backgroundColor || '#0d1117',
    style: { padding: '20px' },
  });

  if (!blob) throw new Error('Failed to generate image');

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
