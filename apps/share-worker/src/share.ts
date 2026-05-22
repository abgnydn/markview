// SPDX-License-Identifier: Apache-2.0

/**
 * markview — /share/:id Worker
 * --------------------------------------------------------------
 * Read-only public renderer for shared notes.
 *
 *   GET /share/:id  →  HTML (200) | Not found (404)
 *
 * The user's local MCP server is the only writer to R2; this Worker
 * only reads. The doc is stored as raw markdown at key `:id` (or
 * `:id.md`) in the R2 bucket bound as `SHARES`.
 *
 * Optional KV (`SHARE_KV`) lookup maps an opaque share-id to an R2
 * object key + metadata (title, description, expiry). When the KV
 * binding has the id we honour it; otherwise we fall back to using
 * the id directly as the R2 key.
 *
 * No Node APIs — V8 isolate only. Web standards: Fetch, ReadableStream.
 */

import type { R2Bucket, KVNamespace, DurableObjectNamespace } from "@cloudflare/workers-types";

export interface ShareEnv {
  SHARES: R2Bucket;
  SHARE_KV?: KVNamespace;
  YJS_SIGNAL?: DurableObjectNamespace;
}

interface ShareMeta {
  /** Object key inside the SHARES bucket. */
  key: string;
  /** Optional override title (else parsed from frontmatter / first H1). */
  title?: string;
  /** Optional plain-text description for og:description. */
  description?: string;
  /** Unix seconds — past = 410 Gone. */
  expiresAt?: number;
}

const ROUTE = /^\/share\/([A-Za-z0-9._~-]{1,128})\/?$/;
const ONE_HOUR = 3600;

export default {
  async fetch(request: Request, env: ShareEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405 });
    }

    const m = ROUTE.exec(url.pathname);
    if (!m) return new Response("not found", { status: 404 });

    const id = m[1]!;
    const meta = await resolveMeta(id, env);
    if (!meta) return notFound();

    if (meta.expiresAt && meta.expiresAt * 1000 < Date.now()) {
      return new Response("share expired", { status: 410 });
    }

    const obj = await env.SHARES.get(meta.key);
    if (!obj) return notFound();

    const md = await obj.text();
    const parsed = parseDoc(md);
    const title = meta.title ?? parsed.title ?? "markview share";
    const description = meta.description ?? parsed.description ?? "Shared from markview.app";
    const html = renderHtml({ id, title, description, body: renderMarkdown(parsed.body) });

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": `public, max-age=${ONE_HOUR}, s-maxage=${ONE_HOUR}`,
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    });
  },
};

async function resolveMeta(id: string, env: ShareEnv): Promise<ShareMeta | null> {
  if (env.SHARE_KV) {
    const raw = await env.SHARE_KV.get(`share:${id}`, "json");
    if (raw && typeof raw === "object") {
      const r = raw as Partial<ShareMeta>;
      if (typeof r.key === "string") return r as ShareMeta;
    }
  }
  // Fallback: id IS the R2 key. Probe the bucket cheaply.
  const head = await env.SHARES.head(id);
  if (head) return { key: id };
  const headMd = await env.SHARES.head(`${id}.md`);
  if (headMd) return { key: `${id}.md` };
  return null;
}

function notFound(): Response {
  return new Response(
    renderHtml({
      id: "",
      title: "Not found",
      description: "This shared note no longer exists.",
      body: "<p>This share link is invalid or has been revoked.</p>",
    }),
    {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

// --- doc parsing -----------------------------------------------------------

interface ParsedDoc {
  title?: string;
  description?: string;
  body: string;
}

function parseDoc(raw: string): ParsedDoc {
  let body = raw;
  let title: string | undefined;
  let description: string | undefined;

  // YAML frontmatter — only `title:` and `description:` are read; we don't
  // pull a real YAML lib in to keep the Worker bundle tiny.
  if (body.startsWith("---\n") || body.startsWith("---\r\n")) {
    const end = body.indexOf("\n---", 4);
    if (end > 0) {
      const fm = body.slice(4, end);
      body = body.slice(end + 4).replace(/^\s*\n/, "");
      for (const line of fm.split(/\r?\n/)) {
        const t = /^title:\s*(.+?)\s*$/.exec(line);
        if (t) title = stripQuotes(t[1]!);
        const d = /^description:\s*(.+?)\s*$/.exec(line);
        if (d) description = stripQuotes(d[1]!);
      }
    }
  }

  if (!title) {
    const h1 = /^#\s+(.+?)\s*$/m.exec(body);
    if (h1) title = h1[1];
  }
  if (!description) {
    const para = body.replace(/^#.*$/gm, "").trim().split(/\n\s*\n/)[0];
    if (para) description = para.replace(/\s+/g, " ").slice(0, 200);
  }

  return { title, description, body };
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, "");
}

// --- minimal markdown renderer --------------------------------------------
// Hand-rolled to avoid pulling marked/markdown-it into the bundle. Covers:
// headings, bold, italic, inline code, fenced code, links, lists, blockquotes,
// hr, paragraphs. Output is HTML-escaped first; only a known set of inline
// tokens are reintroduced as tags.

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    // fenced code
    const fence = /^```(\w+)?\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? "")) {
        buf.push(lines[i] ?? "");
        i++;
      }
      i++;
      const cls = lang ? ` class="language-${escapeAttr(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // hr
    if (/^(\*\s*\*\s*\*+|-\s*-\s*-+|_\s*_\s*_+)\s*$/.test(line)) {
      out.push("<hr/>");
      i++;
      continue;
    }

    // headings
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      out.push(`<h${level}>${inline(h[2]!)}</h${level}>`);
      i++;
      continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("> ")) {
        buf.push((lines[i] ?? "").slice(2));
        i++;
      }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`);
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`);
      continue;
    }

    // blank
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // paragraph (collect until blank)
    const buf: string[] = [];
    while (i < lines.length && !/^\s*$/.test(lines[i] ?? "") && !startsBlock(lines[i] ?? "")) {
      buf.push(lines[i] ?? "");
      i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

function startsBlock(l: string): boolean {
  return (
    /^#{1,6}\s+/.test(l) ||
    /^```/.test(l) ||
    /^>\s/.test(l) ||
    /^\s*[-*+]\s+/.test(l) ||
    /^\s*\d+\.\s+/.test(l) ||
    /^(\*\s*\*\s*\*+|-\s*-\s*-+|_\s*_\s*_+)\s*$/.test(l)
  );
}

function inline(src: string): string {
  // Escape first, then walk tokens.
  let s = escapeHtml(src);
  // inline code
  s = s.replace(/`([^`]+?)`/g, (_, code) => `<code>${code}</code>`);
  // links [text](href) — href is already HTML-escaped; reject anything that
  // isn't an http(s)/mailto/relative link to prevent javascript: schemes.
  s = s.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (_, text, href) => {
    if (!isSafeHref(href)) return text;
    return `<a href="${href}" rel="nofollow noopener">${text}</a>`;
  });
  // bold then italic (order matters)
  s = s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+?)_/g, "<em>$1</em>");
  return s;
}

function isSafeHref(href: string): boolean {
  if (/^(https?:|mailto:)/i.test(href)) return true;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// --- HTML shell -----------------------------------------------------------

interface PageProps {
  id: string;
  title: string;
  description: string;
  body: string;
}

function renderHtml(p: PageProps): string {
  const title = escapeHtml(p.title);
  const desc = escapeHtml(p.description);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<meta name="description" content="${desc}"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="markview.app"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${desc}"/>
<style>
  :root { --bg:#07070c; --fg:#e9e9f0; --muted:#9b9bb0; --accent:#8a6dff; --border:#1a1a26; }
  html,body { margin:0; background:var(--bg); color:var(--fg); }
  body { font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Space Grotesk", Inter, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 4rem 1.25rem 6rem; }
  h1,h2,h3,h4,h5,h6 { font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif; line-height:1.2; }
  h1 { font-size: 2rem; margin: 0 0 1rem; }
  h2 { font-size: 1.5rem; margin: 2rem 0 .75rem; }
  h3 { font-size: 1.2rem; margin: 1.5rem 0 .5rem; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background:#11111a; padding: 0 .25em; border-radius: 3px; }
  pre { background:#0d0d16; border:1px solid var(--border); border-radius: 8px; padding: 1rem; overflow:auto; }
  pre code { background: transparent; padding: 0; }
  blockquote { margin: 1rem 0; padding: .25rem 1rem; border-left: 3px solid var(--accent); color: var(--muted); }
  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
  ul,ol { padding-left: 1.5rem; }
  footer { margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: .85rem; }
  footer a { color: var(--muted); }
</style>
</head>
<body>
<main>
${p.body}
<footer>
  Shared from <a href="https://markview.app">markview.app</a> — read-only.
</footer>
</main>
</body>
</html>`;
}
