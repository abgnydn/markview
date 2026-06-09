#!/usr/bin/env node
// Generates apps/web/out/projects/index.html — a fully static snapshot of
// the /projects page for crawlers / AI agents / no-JS readers / Slack
// unfurls. Real visitors with JS still get the interactive zen-magazine
// React component; the snapshot is the initial paint that React replaces
// on hydration.
//
// Runs as POSTBUILD (not prebuild). That matters: we read the already-
// built apps/web/out/index.html so the `<script src="/assets/index-<HASH>.js">`
// tags Vite produced (with content hashes) survive into the snapshot —
// the previous prebuild version embedded the dev URL `/src/main.tsx`,
// which 404s in prod and prevented React from ever mounting.
//
// Wiring (package.json):
//   "build": "vite build && node scripts/prerender-projects.mjs"

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const portfolioJsonPath = path.resolve(webRoot, "out/portfolio/index.json");
const builtIndexPath = path.resolve(webRoot, "out/index.html");
const outDir = path.resolve(webRoot, "out/projects");
const outPath = path.resolve(outDir, "index.html");

if (!fs.existsSync(builtIndexPath)) {
  console.error(`✗ built index missing at ${builtIndexPath}; run 'vite build' first`);
  process.exit(1);
}
if (!fs.existsSync(portfolioJsonPath)) {
  console.error(`✗ portfolio JSON missing at ${portfolioJsonPath}; run sync-portfolio.mjs first`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(portfolioJsonPath, "utf-8"));
const indexHtml = fs.readFileSync(builtIndexPath, "utf-8");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Sort projects: featured first (in declared `order`), then by recent push.
const sorted = [...data.projects].sort((a, b) => {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  if (a.featured && b.featured) return (a.order ?? 99) - (b.order ?? 99);
  return (b.pushed_at || "").localeCompare(a.pushed_at || "");
});

const projectTiles = sorted.map((p) => {
  const live = p.live_url ? `<a href="${esc(p.live_url)}" class="prerendered-link prerendered-link-live" rel="noopener nofollow">live ↗</a>` : "";
  const stars = p.stars > 0 ? `<span class="prerendered-meta-item">★ ${p.stars}</span>` : "";
  const commits = p.commits_30d > 0 ? `<span class="prerendered-meta-item">${p.commits_30d} commits/30d</span>` : "";
  const lang = p.language ? `<span class="prerendered-meta-item prerendered-meta-lang">${esc(p.language)}</span>` : "";
  // Prefer manifest-authored tags (controlled vocab, colored per category)
  // over the GitHub `topics` field, which is usually unset.
  const tagChips = (p.tags || []).slice(0, 4).map((t) => {
    const def = (data.categories || {})[t];
    const color = def?.color ?? "#a5a5b2";
    const label = def?.label ?? t;
    return `<span class="prerendered-tag-chip" style="border-color:${color};color:${color};">${esc(label)}</span>`;
  }).join("");
  const topics = (p.topics || []).slice(0, 4).map((t) => `<span class="prerendered-topic">${esc(t)}</span>`).join("");
  const featured = p.featured ? ' data-featured="true"' : '';
  return `
  <article class="prerendered-tile"${featured}>
    <h2><a href="/p/${esc(p.slug)}">${esc(p.name)}</a></h2>
    <p class="prerendered-tag">${esc(p.tagline)}</p>
    <div class="prerendered-meta">
      ${lang}${stars}${commits}
    </div>
    ${tagChips ? `<div class="prerendered-tag-chips">${tagChips}</div>` : ""}
    ${topics ? `<div class="prerendered-topics">${topics}</div>` : ""}
    <div class="prerendered-links">
      <a href="${esc(p.repo_url)}" class="prerendered-link" rel="noopener nofollow">github →</a>
      ${live}
    </div>
  </article>`;
}).join("\n");

const totalCommits = data.activity_90d_total ?? Object.values(data.activity_90d || {}).reduce((a, b) => a + b, 0);
const totalStars = data.projects.reduce((s, p) => s + (p.stars || 0), 0);
const languages = [...new Set(data.projects.map((p) => p.language).filter(Boolean))];
const synced = new Date(data.generated_at);

const ogTitle = "Projects — Ahmet Barış Günaydın";
const ogDesc = `${data.project_count} open-source repos · ${totalCommits.toLocaleString()} commits in last 90 days · WebGPU kernels, browser-native quantum chemistry, local-first AI infrastructure. Independent research.`;

const projectListHTML = `
<main class="prerendered-shell">
  <header class="prerendered-masthead">
    <p class="prerendered-eyebrow">portfolio · barisgunaydin.com</p>
    <h1>Projects</h1>
    <p class="prerendered-lede">${esc(ogDesc)}</p>
    <dl class="prerendered-stats">
      <div><dt>projects</dt><dd>${data.project_count}</dd></div>
      <div><dt>commits · 90d</dt><dd>${totalCommits.toLocaleString()}</dd></div>
      <div><dt>★ stars</dt><dd>${totalStars}</dd></div>
      <div><dt>languages</dt><dd>${languages.length}</dd></div>
    </dl>
    <p class="prerendered-generated">synced ${synced.toISOString().slice(0, 10)} · interactive view loads in &lt;1 s with JS</p>
  </header>
  <section class="prerendered-grid" aria-label="Projects">
    ${projectTiles}
  </section>
  <footer class="prerendered-footer">
    <p>Pre-rendered snapshot for crawlers + AI agents + no-JS readers. With JS enabled you get the interactive grid — heatmap, sparkline, commit river, search, filters, and an in-browser chat that knows every project. Source: <a href="https://github.com/abgnydn/markview" rel="noopener">github.com/abgnydn/markview</a>.</p>
  </footer>
</main>
`;

// Zen-paper aesthetic on the snapshot so the flash matches the React UI:
// warm dark by default, light fallback when html lacks the .dark class.
// Full-bleed background painted on :root + body — no white box centered
// on a dark page. The container has its own max-width for readability.
const inlineStyles = `
  <style>
    :root { color-scheme: dark light; }
    html, body { background: #0b0a0d; color: #ece8e0; }
    html:not(.dark):not([data-theme="dark"]) body { background: #fbf8f3; color: #1c1816; }

    .prerendered-shell {
      font-family: "Iowan Old Style", Charter, Iowan, "Source Serif Pro", "New York", Georgia, serif;
      max-width: 1180px;
      margin: 0 auto;
      padding: 14vh 32px 8vh;
      min-height: 100vh;
      box-sizing: border-box;
      background: transparent;
    }
    .prerendered-masthead { padding-bottom: 5vh; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 6vh; }
    html:not(.dark):not([data-theme="dark"]) .prerendered-masthead { border-bottom-color: rgba(28,24,22,0.09); }
    .prerendered-eyebrow {
      font-family: "Berkeley Mono", "JetBrains Mono", ui-monospace, monospace;
      font-size: 10.5px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(236,232,224,0.46);
      margin: 0 0 18px;
    }
    html:not(.dark):not([data-theme="dark"]) .prerendered-eyebrow { color: rgba(28,24,22,0.46); }
    .prerendered-masthead h1 {
      font-size: clamp(56px, 9vw, 124px);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 0.96;
      margin: 0 0 22px;
      text-indent: -0.04em;
    }
    .prerendered-lede {
      font-family: "Iowan Old Style", Charter, Georgia, serif;
      font-size: 18px;
      line-height: 1.6;
      margin: 0 0 36px;
      max-width: 72ch;
      opacity: 0.82;
    }
    .prerendered-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 24px 32px;
      margin: 0 0 18px;
    }
    .prerendered-stats > div { min-width: 0; }
    .prerendered-stats dt {
      font-family: "Berkeley Mono", ui-monospace, monospace;
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(236,232,224,0.46);
      margin: 0 0 6px;
    }
    html:not(.dark):not([data-theme="dark"]) .prerendered-stats dt { color: rgba(28,24,22,0.46); }
    .prerendered-stats dd {
      font-family: inherit;
      font-size: clamp(28px, 3.6vw, 48px);
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1;
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .prerendered-generated {
      font-family: "Berkeley Mono", ui-monospace, monospace;
      font-size: 10.5px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(236,232,224,0.46);
      margin: 18px 0 0;
    }
    html:not(.dark):not([data-theme="dark"]) .prerendered-generated { color: rgba(28,24,22,0.46); }

    .prerendered-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 4px;
      overflow: hidden;
    }
    html:not(.dark):not([data-theme="dark"]) .prerendered-grid {
      background: rgba(28,24,22,0.09);
      border-color: rgba(28,24,22,0.09);
    }
    .prerendered-tile {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 18px 20px;
      background: #0b0a0d;
      min-height: 150px;
    }
    html:not(.dark):not([data-theme="dark"]) .prerendered-tile { background: #fbf8f3; }
    .prerendered-tile[data-featured="true"] { background: rgba(255,255,255,0.025); }
    html:not(.dark):not([data-theme="dark"]) .prerendered-tile[data-featured="true"] { background: rgba(28,24,22,0.025); }
    .prerendered-tile h2 {
      font-family: "Berkeley Mono", ui-monospace, monospace;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 500;
      margin: 0;
    }
    .prerendered-tile h2 a { color: inherit; text-decoration: none; }
    .prerendered-tile h2 a:hover { color: #9b7dff; }
    .prerendered-tag {
      font-family: "Iowan Old Style", Charter, Georgia, serif;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
      opacity: 0.82;
      flex: 1;
    }
    .prerendered-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-family: "Berkeley Mono", ui-monospace, monospace;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.6;
    }
    .prerendered-meta-lang { color: #e0bd7a; }
    .prerendered-topics { display: flex; flex-wrap: wrap; gap: 4px; }
    .prerendered-tag-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .prerendered-tag-chip {
      font-family: "Berkeley Mono", ui-monospace, monospace;
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      padding: 2px 7px;
      border: 1px solid;
      border-radius: 3px;
      background: transparent;
      white-space: nowrap;
    }
    .prerendered-topic {
      font-family: "Berkeley Mono", ui-monospace, monospace;
      font-size: 9.5px;
      letter-spacing: 0.10em;
      padding: 2px 8px;
      background: rgba(255,255,255,0.04);
      border-radius: 9999px;
      opacity: 0.8;
    }
    html:not(.dark):not([data-theme="dark"]) .prerendered-topic { background: rgba(28,24,22,0.05); }
    .prerendered-links {
      display: flex;
      gap: 16px;
      font-family: "Berkeley Mono", ui-monospace, monospace;
      font-size: 10px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .prerendered-link { color: inherit; text-decoration: none; opacity: 0.7; transition: color 180ms; }
    .prerendered-link:hover { color: #9b7dff; opacity: 1; }
    .prerendered-link-live { color: #9b7dff; opacity: 0.95; }
    .prerendered-footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-family: "Iowan Old Style", Charter, Georgia, serif;
      font-size: 14px;
      line-height: 1.6;
      opacity: 0.6;
    }
    html:not(.dark):not([data-theme="dark"]) .prerendered-footer { border-top-color: rgba(28,24,22,0.09); }
    .prerendered-footer a { color: inherit; }

    @media (max-width: 720px) {
      .prerendered-shell { padding: 8vh 16px 6vh; }
      .prerendered-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>`;

const ogMetaTags = `
    <meta property="og:title" content="${esc(ogTitle)}" />
    <meta property="og:description" content="${esc(ogDesc)}" />
    <meta property="og:image" content="https://markview.ai/og-image.png" />
    <meta property="og:type" content="profile" />
    <meta property="og:url" content="https://markview.ai/projects" />
    <meta property="og:site_name" content="MarkView" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(ogTitle)}" />
    <meta name="twitter:description" content="${esc(ogDesc)}" />
    <meta name="twitter:image" content="https://markview.ai/og-image.png" />
    <link rel="canonical" href="https://markview.ai/projects" />
    <meta name="robots" content="index, follow" />`;

let newHtml = indexHtml
  .replace(/<title>.*?<\/title>/, `<title>${esc(ogTitle)}</title>`)
  .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(ogDesc)}" />`)
  .replace("</head>", `${ogMetaTags}${inlineStyles}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${projectListHTML}</div>`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, newHtml);
const sizeKb = (Buffer.byteLength(newHtml, "utf-8") / 1024).toFixed(1);
console.log(`✓ Prerendered ${data.projects.length} projects → ${path.relative(webRoot, outPath)} (${sizeKb} KB)`);
