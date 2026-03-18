'use client';

/**
 * URL Sharing — encode/decode markdown content in shareable URLs.
 *
 * Uses gzip compression + base64url encoding to keep URLs manageable.
 * Max ~32KB of compressed content (browser URL limit is ~2KB for some,
 * but we use the hash fragment which has no server-side limit).
 *
 * Format: https://markview.app/#md=<base64url-gzipped-content>&title=<encoded-title>
 */

/** Compress and encode markdown into a URL-safe string */
export async function encodeMarkdownUrl(content: string, title?: string): Promise<string> {
  // Compress with gzip via CompressionStream API
  const encoder = new TextEncoder();
  const stream = new Blob([encoder.encode(content)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));

  const compressed = await new Response(stream).arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(compressed)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const params = new URLSearchParams();
  params.set('md', base64);
  if (title) params.set('title', title);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/#${params.toString()}`;
}

/** Decode a URL hash back into markdown content and optional title */
export async function decodeMarkdownUrl(hash: string): Promise<{ content: string; title?: string } | null> {
  if (!hash || !hash.includes('md=')) return null;

  try {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const base64 = params.get('md');
    const title = params.get('title') || undefined;

    if (!base64) return null;

    // Restore base64 padding
    const padded = base64
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      + '==='.slice(0, (4 - (base64.length % 4)) % 4);

    const compressed = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

    // Decompress
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));

    const decompressed = await new Response(stream).text();
    return { content: decompressed, title };
  } catch {
    console.warn('Failed to decode markdown URL');
    return null;
  }
}

/** Check the current URL for shared markdown content */
export async function checkUrlForSharedContent(): Promise<{ content: string; title?: string } | null> {
  if (typeof window === 'undefined') return null;
  return decodeMarkdownUrl(window.location.hash);
}

/** Get approximate URL length for a given content (for UI warnings) */
export function estimateUrlLength(content: string): number {
  // Rough estimate: gzip usually compresses markdown ~60-70%
  // base64 expands by 33%
  const estimatedCompressed = content.length * 0.35;
  const estimatedBase64 = estimatedCompressed * 1.33;
  return Math.ceil(estimatedBase64) + 50; // 50 for the URL prefix
}

/** Max recommended content length (keeps URLs under ~8KB) */
export const MAX_SHAREABLE_LENGTH = 15000; // ~15KB raw → ~7KB compressed+encoded
