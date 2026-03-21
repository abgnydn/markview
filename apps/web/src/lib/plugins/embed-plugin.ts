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

function gistEmbed(url: string): string | null {
  const m = url.match(/gist\.github\.com\/([a-zA-Z0-9_-]+)\/([a-f0-9]+)/);
  if (m) return `${m[1]}/${m[2]}`;
  return null;
}

function twitterEmbed(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/([0-9]+)/);
  if (m) return m[1];
  return null;
}

function spotifyEmbed(url: string): { type: string; id: string } | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
  if (m) return { type: m[1], id: m[2] };
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

  // GitHub Gist
  const gistPath = gistEmbed(url);
  if (gistPath) {
    return `<div class="plugin-embed plugin-embed-gist" style="${wrapStyle}">
      <div style="padding: 8px 14px; font-size: 12px; font-weight: 600; color: ${theme === 'dark' ? '#c9d1d9' : '#24292f'}; background: ${theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'}; border-bottom: 1px solid ${borderColor}; display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75zM0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm9.22 3.72a.75.75 0 000 1.06L10.69 8 9.22 9.47a.75.75 0 101.06 1.06l2-2a.75.75 0 000-1.06l-2-2a.75.75 0 00-1.06 0zM6.78 6.53a.75.75 0 00-1.06-1.06l-2 2a.75.75 0 000 1.06l2 2a.75.75 0 101.06-1.06L5.31 8l1.47-1.47z"/></svg>
        GitHub Gist
      </div>
      <iframe ${iframeBase} height="350" src="https://gist.github.com/${gistPath}.pibb" style="background: ${theme === 'dark' ? '#0d1117' : '#fff'};"></iframe>
    </div>`;
  }

  // Twitter / X
  const tweetId = twitterEmbed(url);
  if (tweetId) {
    const tweetTheme = theme === 'dark' ? 'dark' : 'light';
    return `<div class="plugin-embed plugin-embed-twitter" style="${wrapStyle} max-width: 550px;">
      <blockquote class="twitter-tweet" data-theme="${tweetTheme}">
        <a href="${url}">Loading tweet...</a>
      </blockquote>
      <script async src="https://platform.twitter.com/widgets.js"></script>
    </div>`;
  }

  // Spotify
  const spotify = spotifyEmbed(url);
  if (spotify) {
    const height = spotify.type === 'track' ? '152' : '352';
    return `<div class="plugin-embed plugin-embed-spotify" style="${wrapStyle}">
      <iframe ${iframeBase} height="${height}" src="https://open.spotify.com/embed/${spotify.type}/${spotify.id}?theme=${theme === 'dark' ? '0' : '1'}" allow="encrypted-media"></iframe>
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
