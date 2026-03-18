/**
 * Import a workspace from a .zip file.
 * Extracts all .md/.markdown files and returns them as an array.
 */
export async function importWorkspaceZip(
  file: File
): Promise<{ title: string; files: { filename: string; content: string }[] }> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const mdFiles: { filename: string; content: string }[] = [];

  // Iterate all files in the zip
  const entries = Object.entries(zip.files);
  for (const [path, zipEntry] of entries) {
    if (zipEntry.dir) continue;
    if (!path.endsWith('.md') && !path.endsWith('.markdown')) continue;

    const content = await zipEntry.async('string');
    // Strip the top-level folder prefix if all files share one
    mdFiles.push({ filename: path, content });
  }

  if (mdFiles.length === 0) {
    throw new Error('No markdown files found in the ZIP archive');
  }

  // Strip common prefix (e.g., "MyDocs/file.md" → "file.md")
  const commonPrefix = findCommonPrefix(mdFiles.map((f) => f.filename));
  if (commonPrefix) {
    for (const f of mdFiles) {
      f.filename = f.filename.slice(commonPrefix.length);
    }
  }

  // Derive workspace title from zip filename or common prefix
  const title = commonPrefix
    ? commonPrefix.replace(/\/$/, '').split('/').pop() || file.name.replace(/\.zip$/i, '')
    : file.name.replace(/\.zip$/i, '');

  return { title, files: mdFiles };
}

function findCommonPrefix(filenames: string[]): string {
  if (filenames.length <= 1) return '';

  const parts = filenames[0].split('/');
  let prefix = '';

  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = prefix + parts[i] + '/';
    if (filenames.every((f) => f.startsWith(candidate))) {
      prefix = candidate;
    } else {
      break;
    }
  }

  return prefix;
}
