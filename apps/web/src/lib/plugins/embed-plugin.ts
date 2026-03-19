'use client';

import { usePluginStore, type CodeFencePlugin } from './plugin-registry';

/**
 * Embed plugin — renders ```embed code blocks containing URLs as embedded iframes.
 * Supported services:
 * - YouTube (youtube.com, youtu.be)
 * - Figma (figma.com)
 * - CodePen (codepen.io)
 * - CodeSandbox (codesandbox.io)
 * - Loom (loom.com)
 * - Generic URL fallback (iframe)
 */

function extractUrls(content: string): string[] {
  return content
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('http'));
}

function youtubeEmbed(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function figmaEmbed(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    if (hostname === 'figma.com' || hostname.endsWith('.figma.com')) return url;
  } catch {
    // Invalid URL
  }
  return null;
}

function codepenEmbed(url: string): { user: string; pen: string } | null {
  const m = url.match(/codepen\.io\/([^/]+)\/(?:pen|full)\/([a-zA-Z0-9]+)/);
  if (m) return { user: m[1], pen: m[2] };
  return null;
}

function codesandboxEmbed(url: string): string | null {
  const m = url.match(/codesandbox\.io\/(?:s|embed)\/([a-zA-Z0-9-]+)/);
  if (m) return m[1];
  return null;
}

function loomEmbed(url: string): string | null {
  const m = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (m) return m[1];
  return null;
}

function renderUrl(url: string, theme: 'dark' | 'light'): string {
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const wrapStyle = `border: 1px solid ${borderColor}; border-radius: 10px; overflow: hidden; margin: 12px 0;`;
  const iframeBase = 'width="100%" frameborder="0" allowfullscreen style="display:block;"';

  // YouTube
  const ytId = youtubeEmbed(url);
  if (ytId) {
    return `<div class="plugin-embed plugin-embed-youtube" style="${wrapStyle}">
      <iframe ${iframeBase} height="400" src="https://www.youtube.com/embed/${ytId}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
    </div>`;
  }

  // Figma
  const figmaUrl = figmaEmbed(url);
  if (figmaUrl) {
    return `<div class="plugin-embed plugin-embed-figma" style="${wrapStyle}">
      <iframe ${iframeBase} height="500" src="https://embed.figma.com/design?embed_host=markview&url=${encodeURIComponent(figmaUrl)}"></iframe>
    </div>`;
  }

  // CodePen
  const cp = codepenEmbed(url);
  if (cp) {
    return `<div class="plugin-embed plugin-embed-codepen" style="${wrapStyle}">
      <iframe ${iframeBase} height="400" src="https://codepen.io/${cp.user}/embed/${cp.pen}?default-tab=result&theme-id=${theme === 'dark' ? 'dark' : 'light'}"></iframe>
    </div>`;
  }

  // CodeSandbox
  const csb = codesandboxEmbed(url);
  if (csb) {
    return `<div class="plugin-embed plugin-embed-codesandbox" style="${wrapStyle}">
      <iframe ${iframeBase} height="500" src="https://codesandbox.io/embed/${csb}?fontsize=14&hidenavigation=1&theme=${theme}"></iframe>
    </div>`;
  }

  // Loom
  const loomId = loomEmbed(url);
  if (loomId) {
    return `<div class="plugin-embed plugin-embed-loom" style="${wrapStyle}">
      <iframe ${iframeBase} height="400" src="https://www.loom.com/embed/${loomId}" allowfullscreen></iframe>
    </div>`;
  }

  // Generic iframe fallback
  return `<div class="plugin-embed plugin-embed-generic" style="${wrapStyle}">
    <iframe ${iframeBase} height="400" src="${url}" sandbox="allow-scripts allow-same-origin"></iframe>
  </div>`;
}

export const embedPlugin: CodeFencePlugin = {
  id: 'embed',
  name: 'Embed',
  render: (content, theme) => {
    const urls = extractUrls(content);
    if (urls.length === 0) {
      return `<div style="padding: 12px; color: rgba(128,128,128,0.8); font-size: 0.85rem; font-style: italic;">No embed URL found. Add a URL (YouTube, Figma, CodePen, etc.)</div>`;
    }
    return urls.map((url) => renderUrl(url, theme)).join('');
  },
};

// Auto-register on import (once)
let _embedRegistered = false;
if (!_embedRegistered) {
  _embedRegistered = true;
  usePluginStore.setState((state) => {
    const next = new Map(state.plugins);
    next.set(embedPlugin.id, embedPlugin);
    return { plugins: next };
  });
}
