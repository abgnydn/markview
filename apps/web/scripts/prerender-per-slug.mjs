#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// prerender-per-slug.mjs — generates one HTML file per project at
// out/p/<slug>/index.html so /p/:slug URLs:
//   - serve a meaningful pre-rendered snapshot to crawlers / no-JS / AI agents
//   - carry per-project OG meta (pointing at out/og/<slug>.png)
//   - share beautifully on X / Slack / LinkedIn / Bluesky / iMessage
// React still mounts on top via the same prod bundle.
//
// Also writes:
//   out/sitemap.xml — covers /, /projects, every /p/<slug>
//   out/robots.txt — points at sitemap (if not already present)
//
// Runs as part of the build chain AFTER vite + prerender-projects + OG-gen.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const portfolioJsonPath = path.resolve(webRoot, "out/portfolio/index.json");
const builtIndexPath = path.resolve(webRoot, "out/index.html");
const ORIGIN = "https://markview.ai";

if (!fs.existsSync(builtIndexPath)) {
  console.error(`✗ ${builtIndexPath} missing — run vite build first`);
  process.exit(1);
}
if (!fs.existsSync(portfolioJsonPath)) {
  console.error(`✗ ${portfolioJsonPath} missing — run sync-portfolio first`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(portfolioJsonPath, "utf-8"));
const indexHtml = fs.readFileSync(builtIndexPath, "utf-8");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const categories = data.categories ?? {};
function tagLabel(t) { return categories[t]?.label ?? t; }
function tagColor(t) { return categories[t]?.color ?? "#9b7dff"; }

function renderProjectSnapshot(p) {
  const tagChips = (p.tags || []).map((t) =>
    `<span style="display:inline-block;font-family:'Berkeley Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;padding:3px 9px;margin-right:6px;border:1px solid ${tagColor(t)};color:${tagColor(t)};border-radius:3px;">${esc(tagLabel(t))}</span>`
  ).join("");

  const lede = (p.lede && p.lede.length > 40 ? p.lede : p.tagline) || "";
  const live = p.live_url ? `<a href="${esc(p.live_url)}" rel="noopener nofollow" style="color:#9b7dff;text-decoration:none;border:1px solid rgba(155,125,255,0.4);border-radius:3px;padding:6px 14px;font-family:'Berkeley Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">live ↗</a>` : "";

  return `
<main class="prerendered-shell">
  <p class="prerendered-eyebrow"><a href="/projects" style="color:inherit;text-decoration:none;">← portfolio</a> · barisgunaydin.com</p>
  <h1 style="font-size:clamp(56px,9vw,124px);font-weight:700;letter-spacing:-0.035em;line-height:0.96;margin:0 0 22px;">${esc(p.name)}</h1>
  <p style="font-family:'Iowan Old Style',Charter,Georgia,serif;font-size:22px;line-height:1.5;color:rgba(236,232,224,0.82);max-width:72ch;margin:0 0 24px;">${esc(p.tagline || "")}</p>
  ${tagChips ? `<div style="margin:0 0 32px;">${tagChips}</div>` : ""}
  ${lede && lede !== p.tagline ? `<p style="font-family:'Iowan Old Style',Charter,Georgia,serif;font-size:16px;line-height:1.65;color:rgba(236,232,224,0.74);max-width:72ch;margin:0 0 36px;">${esc(lede)}</p>` : ""}
  <div style="display:flex;gap:14px;flex-wrap:wrap;margin:0 0 48px;">
    <a href="${esc(p.repo_url)}" rel="noopener nofollow" style="color:rgba(236,232,224,0.82);text-decoration:none;border:1px solid rgba(236,232,224,0.18);border-radius:3px;padding:6px 14px;font-family:'Berkeley Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;">github →</a>
    ${live}
  </div>
  <p style="font-family:'Berkeley Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(236,232,224,0.46);margin:0 0 8px;">
    ${p.language ? esc(p.language) + " · " : ""}${p.commits_synced} commits synced${p.last_commit ? " · last " + esc(p.last_commit.date.slice(0, 10)) : ""}
  </p>
  <footer class="prerendered-footer">
    <p>This is the static, crawler-friendly snapshot of <code>/p/${esc(p.slug)}</code>. With JS enabled you'll see the full markview workspace — README, changelog, commit history, project chat. Source: <a href="https://github.com/abgnydn/markview" rel="noopener">github.com/abgnydn/markview</a>.</p>
  </footer>
</main>`;
}

// Same zen-paper inline styles as the /projects prerender so /p/:slug
// matches visually for the static-snapshot phase.
const inlineStyles = `
  <style>
    :root { color-scheme: dark light; }
    html, body { background: #0b0a0d; color: #ece8e0; }
    .prerendered-shell {
      font-family: "Iowan Old Style", Charter, "New York", Georgia, serif;
      max-width: 1080px;
      margin: 0 auto;
      padding: 14vh 32px 8vh;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .prerendered-eyebrow {
      font-family: "Berkeley Mono", "JetBrains Mono", ui-monospace, monospace;
      font-size: 10.5px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(236,232,224,0.46);
      margin: 0 0 18px;
    }
    .prerendered-footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-family: "Iowan Old Style", Charter, Georgia, serif;
      font-size: 14px;
      line-height: 1.6;
      opacity: 0.5;
    }
    .prerendered-footer a { color: inherit; }
    @media (max-width: 720px) { .prerendered-shell { padding: 8vh 16px 6vh; } }
  </style>`;

let okCount = 0;
const urls = [
  { loc: `${ORIGIN}/`,         priority: "0.7" },
  { loc: `${ORIGIN}/projects`, priority: "1.0" },
];

for (const p of data.projects) {
  const ogTitle = `${p.name} — ${p.tagline ? p.tagline.slice(0, 70) : "project"}`;
  const ogDesc  = (p.tagline || "").trim();
  const ogImage = `${ORIGIN}/og/${p.slug}.png`;
  const canonical = `${ORIGIN}/p/${p.slug}`;

  const metaTags = `
    <meta property="og:title" content="${esc(ogTitle)}" />
    <meta property="og:description" content="${esc(ogDesc)}" />
    <meta property="og:image" content="${esc(ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:site_name" content="MarkView" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(ogTitle)}" />
    <meta name="twitter:description" content="${esc(ogDesc)}" />
    <meta name="twitter:image" content="${esc(ogImage)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta name="robots" content="index, follow" />`;

  const html = indexHtml
    .replace(/<title>.*?<\/title>/, `<title>${esc(ogTitle)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(ogDesc)}" />`)
    .replace("</head>", `${metaTags}${inlineStyles}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderProjectSnapshot(p)}</div>`);

  const slugDir = path.resolve(webRoot, "out/p", p.slug);
  fs.mkdirSync(slugDir, { recursive: true });
  fs.writeFileSync(path.join(slugDir, "index.html"), html);
  okCount++;
  urls.push({ loc: canonical, priority: "0.8" });
}

// Sitemap.
const lastmod = (data.generated_at || new Date().toISOString()).slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.resolve(webRoot, "out/sitemap.xml"), sitemap);

// Robots.txt (overwrite to include the sitemap pointer).
const robots = `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;
fs.writeFileSync(path.resolve(webRoot, "out/robots.txt"), robots);

console.log(`✓ Per-slug pages: ${okCount} → out/p/<slug>/index.html`);
console.log(`✓ Sitemap: ${urls.length} URLs → out/sitemap.xml`);
console.log(`✓ Robots.txt → out/robots.txt`);
