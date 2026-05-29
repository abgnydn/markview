#!/usr/bin/env node
// Generates apps/web/public/projects/index.html with all project tiles
// pre-rendered as static HTML. Solves the "JS-rendered page is invisible
// to recruiters / crawlers / AI hiring agents" problem documented at
// length in the global CLAUDE.md.
//
// How it works:
//   1. Reads public/portfolio/index.json (synced daily by sync-portfolio.mjs)
//   2. Renders project tiles + masthead as plain HTML
//   3. Uses index.html as the head/body template, injects rendered content
//      inside #root as initial paint
//   4. When the SPA's main.tsx mounts via React.createRoot, it replaces
//      #root with the interactive React Projects component — initial
//      static content gets thrown away naturally
//   5. Crawlers + AI agents + curl + no-JS users see the FULL static page
//
// Build wiring: package.json's "prebuild" runs this so the file lands
// in public/ before vite copies public/ → out/.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const portfolioJsonPath = path.resolve(webRoot, "public/portfolio/index.json");
const indexHtmlPath = path.resolve(webRoot, "index.html");
const outDir = path.resolve(webRoot, "public/projects");
const outPath = path.resolve(outDir, "index.html");

if (!fs.existsSync(portfolioJsonPath)) {
  console.error(`✗ portfolio JSON missing at ${portfolioJsonPath}; run sync-portfolio.mjs first`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(portfolioJsonPath, "utf-8"));
const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Sort projects: featured first, then by recent push date.
const sorted = [...data.projects].sort((a, b) => {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  return (b.pushed_at || "").localeCompare(a.pushed_at || "");
});

const projectTiles = sorted.map((p) => {
  const live = p.live_url ? `<a href="${esc(p.live_url)}" rel="noopener nofollow">live →</a>` : "";
  const stars = p.stars > 0 ? `<span class="meta-item">★ ${p.stars}</span>` : "";
  const commits = p.commits_30d > 0 ? `<span class="meta-item">${p.commits_30d} commits/30d</span>` : "";
  const lang = p.language ? `<span class="meta-item lang">${esc(p.language)}</span>` : "";
  const topics = (p.topics || []).slice(0, 4).map((t) => `<span class="topic">${esc(t)}</span>`).join("");
  return `
  <article class="project-tile">
    <h2><a href="/p/${esc(p.slug)}">${esc(p.name)}</a></h2>
    <p class="tagline">${esc(p.tagline)}</p>
    <div class="meta">
      ${lang}
      ${stars}
      ${commits}
    </div>
    ${topics ? `<div class="topics">${topics}</div>` : ""}
    <div class="links">
      <a href="${esc(p.repo_url)}" rel="noopener nofollow">github →</a>
      ${live}
    </div>
  </article>`;
}).join("\n");

const totalCommits = data.activity_90d_total ?? Object.values(data.activity_90d || {}).reduce((a, b) => a + b, 0);
const totalStars = data.projects.reduce((s, p) => s + (p.stars || 0), 0);
const languages = [...new Set(data.projects.map((p) => p.language).filter(Boolean))];
const synced = new Date(data.generated_at);

const ogTitle = "Projects — Ahmet Barış Günaydın";
const ogDesc = `${data.project_count} open-source repos · ${totalCommits} commits in last 90 days · WebGPU kernels, browser-native quantum chemistry, local-first AI infrastructure. Independent research.`;

const projectListHTML = `
<main class="prerendered-projects">
  <header class="masthead">
    <h1>Projects</h1>
    <p class="lede">${esc(ogDesc)}</p>
    <dl class="stats">
      <div><dt>Repos</dt><dd>${data.project_count}</dd></div>
      <div><dt>Commits (90d)</dt><dd>${totalCommits.toLocaleString()}</dd></div>
      <div><dt>★ Stars</dt><dd>${totalStars}</dd></div>
      <div><dt>Languages</dt><dd>${languages.length}</dd></div>
    </dl>
    <p class="generated">synced ${synced.toISOString().slice(0, 10)} · interactive view loads here in &lt;1 s with JS enabled</p>
  </header>
  <section class="project-grid" aria-label="Projects">
    ${projectTiles}
  </section>
  <footer class="prerendered-footer">
    <p>This is a pre-rendered static snapshot for crawlers + AI agents + no-JS browsers. With JS enabled you'll see the interactive grid with search, filters, an aggregated commit river, and a project chat. Source: <a href="https://github.com/abgnydn/markview" rel="noopener">github.com/abgnydn/markview</a>.</p>
  </footer>
</main>
`;

const inlineStyles = `
  <style>
    .prerendered-projects { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 2rem 1.25rem; color: #2a2a2e; background: #fbf8f3; min-height: 100vh; }
    @media (prefers-color-scheme: dark) { .prerendered-projects { color: #e6e3dd; background: #0b0a0d; } }
    .prerendered-projects .masthead { margin-bottom: 2.5rem; }
    .prerendered-projects .masthead h1 { font-size: 2.5rem; line-height: 1.1; margin: 0 0 0.5rem; font-weight: 700; letter-spacing: -0.02em; }
    .prerendered-projects .lede { font-size: 1.05rem; line-height: 1.5; margin: 0 0 1.5rem; opacity: 0.85; max-width: 70ch; }
    .prerendered-projects .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin: 0 0 1rem; }
    .prerendered-projects .stats > div { padding: 0.75rem 1rem; border: 1px solid rgba(127,127,127,0.2); border-radius: 8px; }
    .prerendered-projects .stats dt { font-size: 0.75rem; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
    .prerendered-projects .stats dd { font-size: 1.5rem; font-weight: 600; margin: 0.25rem 0 0; line-height: 1; }
    .prerendered-projects .generated { font-size: 0.8rem; opacity: 0.55; margin: 0 0 0; }
    .prerendered-projects .project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .prerendered-projects .project-tile { display: block; padding: 1.25rem; border: 1px solid rgba(127,127,127,0.2); border-radius: 8px; background: rgba(255,255,255,0.4); }
    @media (prefers-color-scheme: dark) { .prerendered-projects .project-tile { background: rgba(255,255,255,0.02); } }
    .prerendered-projects .project-tile h2 { font-size: 1.05rem; margin: 0 0 0.4rem; font-weight: 600; line-height: 1.3; }
    .prerendered-projects .project-tile h2 a { color: inherit; text-decoration: none; }
    .prerendered-projects .project-tile h2 a:hover { text-decoration: underline; }
    .prerendered-projects .tagline { margin: 0 0 0.75rem; font-size: 0.9rem; line-height: 1.45; opacity: 0.85; }
    .prerendered-projects .meta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.75rem; opacity: 0.65; margin-bottom: 0.5rem; }
    .prerendered-projects .meta-item.lang { font-weight: 600; }
    .prerendered-projects .topics { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.75rem; }
    .prerendered-projects .topic { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 12px; background: rgba(127,127,127,0.15); }
    .prerendered-projects .links { display: flex; gap: 1rem; font-size: 0.85rem; }
    .prerendered-projects .links a { color: inherit; text-decoration: none; opacity: 0.85; }
    .prerendered-projects .links a:hover { opacity: 1; text-decoration: underline; }
    .prerendered-projects .prerendered-footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(127,127,127,0.15); font-size: 0.85rem; opacity: 0.7; line-height: 1.5; }
    .prerendered-projects .prerendered-footer a { color: inherit; }
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
  // Update title
  .replace(/<title>.*?<\/title>/, `<title>${esc(ogTitle)}</title>`)
  // Replace description with project-focused one
  .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(ogDesc)}" />`)
  // Inject OG tags + inline styles right before </head>
  .replace("</head>", `${ogMetaTags}${inlineStyles}\n  </head>`)
  // Replace empty #root div with pre-rendered content as the initial paint;
  // React.createRoot in main.tsx will replace this when the SPA mounts
  .replace('<div id="root"></div>', `<div id="root">${projectListHTML}</div>`);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, newHtml);
const sizeKb = (Buffer.byteLength(newHtml, "utf-8") / 1024).toFixed(1);
console.log(`✓ Prerendered ${data.projects.length} projects → ${path.relative(webRoot, outPath)} (${sizeKb} KB)`);
