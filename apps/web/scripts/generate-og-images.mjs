#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// generate-og-images.mjs — per-project Open Graph cards (1200×630 PNG)
// generated at build time via satori + resvg. One PNG per slug lands in
// out/og/<slug>.png; the per-slug pre-rendered HTML at out/p/<slug>/index.html
// references it via <meta property="og:image">. Result: every Slack /
// X / LinkedIn / iMessage / Discord / Bluesky / Mastodon unfurl of a
// project URL becomes a branded card with title + tagline + tag chips.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const portfolioJsonPath = path.resolve(webRoot, "out/portfolio/index.json");
const outDir = path.resolve(webRoot, "out/og");

if (!fs.existsSync(portfolioJsonPath)) {
  console.error(`✗ portfolio JSON missing at ${portfolioJsonPath}`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(portfolioJsonPath, "utf-8"));

// Fonts — bundled via @fontsource. Read once.
const fontInterBoldPath  = path.resolve(webRoot, "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff");
const fontInterReg       = path.resolve(webRoot, "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff");
const fontMonoReg        = path.resolve(webRoot, "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff");

// Try woff, fall back to ttf path used by some @fontsource layouts.
function readFontOrFallback(primary, fallback) {
  for (const p of [primary, fallback]) {
    if (p && fs.existsSync(p)) return fs.readFileSync(p);
  }
  return null;
}
const fontBold = readFontOrFallback(fontInterBoldPath, fontInterBoldPath.replace(".woff", ".ttf"));
const fontReg  = readFontOrFallback(fontInterReg, fontInterReg.replace(".woff", ".ttf"));
const fontMono = readFontOrFallback(fontMonoReg, fontMonoReg.replace(".woff", ".ttf"));

if (!fontBold || !fontReg || !fontMono) {
  console.error("✗ required fonts not found — checked @fontsource paths under node_modules");
  process.exit(1);
}

const fonts = [
  { name: "Inter", data: fontBold, weight: 700, style: "normal" },
  { name: "Inter", data: fontReg,  weight: 400, style: "normal" },
  { name: "JetBrainsMono", data: fontMono, weight: 400, style: "normal" },
];

// Tag chip color from manifest categories (falls back to neutral).
const categories = data.categories ?? {};
function tagColor(t) { return categories[t]?.color ?? "#9b7dff"; }
function tagLabel(t) { return categories[t]?.label ?? t; }

// React-style nodes (satori takes JSX or plain objects; using objects).
function div(style, children) { return { type: "div", props: { style, children } }; }
function span(style, children) { return { type: "span", props: { style, children } }; }

function cardFor(p) {
  const featured = !!p.featured;
  const liveBadge = p.live_url ? span(
    { display: "flex", alignItems: "center", gap: 6, fontSize: 18, color: "#9b7dff", fontFamily: "JetBrainsMono", letterSpacing: 2, textTransform: "uppercase" },
    "live ↗"
  ) : null;

  const tagChips = (p.tags || []).slice(0, 4).map((t, i) =>
    span(
      {
        display: "flex",
        marginRight: 10,
        marginTop: 12,
        padding: "6px 14px",
        border: `1px solid ${tagColor(t)}`,
        color: tagColor(t),
        borderRadius: 4,
        fontSize: 18,
        fontFamily: "JetBrainsMono",
        letterSpacing: 2.4,
        textTransform: "uppercase",
      },
      tagLabel(t)
    )
  );

  return div(
    {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "70px 80px",
      background: "linear-gradient(135deg, #0b0a0d 0%, #1a1525 100%)",
      color: "#ece8e0",
      fontFamily: "Inter",
    },
    [
      // top row
      div(
        { display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "JetBrainsMono", fontSize: 18, color: "rgba(236,232,224,0.5)", letterSpacing: 2.4, textTransform: "uppercase" },
        [
          span({ display: "flex" }, "barisgunaydin.com · projects"),
          featured ? span({ display: "flex", color: "#9b7dff" }, `featured · ${String(p.order ?? "").padStart(2, "0")}`) : span({ display: "flex" }, ""),
        ]
      ),
      // middle — title + tagline
      div(
        { display: "flex", flexDirection: "column", marginTop: 10 },
        [
          span({ display: "flex", fontSize: 96, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, color: "#ece8e0" }, p.name),
          span({ display: "flex", marginTop: 22, fontSize: 30, lineHeight: 1.35, color: "rgba(236,232,224,0.82)", maxWidth: 1040 }, p.tagline || ""),
        ]
      ),
      // bottom — tag chips + live + lang
      div(
        { display: "flex", flexDirection: "column", marginTop: 10 },
        [
          tagChips.length > 0
            ? div({ display: "flex", flexWrap: "wrap" }, tagChips)
            : div({ display: "flex" }, ""),
          div(
            { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, fontFamily: "JetBrainsMono", fontSize: 18, color: "rgba(236,232,224,0.5)", letterSpacing: 2.4, textTransform: "uppercase" },
            [
              span({ display: "flex" }, p.language ? `${p.language}` : ""),
              liveBadge ?? span({ display: "flex" }, ""),
            ]
          ),
        ]
      ),
    ]
  );
}

fs.mkdirSync(outDir, { recursive: true });

let okCount = 0, errCount = 0;
for (const p of data.projects) {
  try {
    const svg = await satori(cardFor(p), { width: 1200, height: 630, fonts });
    const png = new Resvg(svg, { background: "#0b0a0d" }).render().asPng();
    fs.writeFileSync(path.join(outDir, `${p.slug}.png`), png);
    okCount++;
  } catch (err) {
    console.error(`✗ ${p.slug}: ${err.message?.split("\n")[0] ?? err}`);
    errCount++;
  }
}

// Also generate a "constellation" OG image for /projects itself.
try {
  const root = div(
    {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "80px 80px",
      background: "linear-gradient(135deg, #0b0a0d 0%, #1a1525 100%)",
      color: "#ece8e0",
      fontFamily: "Inter",
    },
    [
      span({ display: "flex", fontFamily: "JetBrainsMono", fontSize: 18, color: "rgba(236,232,224,0.5)", letterSpacing: 2.4, textTransform: "uppercase" }, "portfolio · barisgunaydin.com"),
      div(
        { display: "flex", flexDirection: "column" },
        [
          span({ display: "flex", fontSize: 168, fontWeight: 700, letterSpacing: -5, lineHeight: 1, color: "#ece8e0" }, "Projects"),
          span({ display: "flex", marginTop: 28, fontSize: 28, lineHeight: 1.4, color: "rgba(236,232,224,0.82)", maxWidth: 1040 }, `${data.project_count} open-source repos · WebGPU kernels · browser-native quantum chemistry · local-first AI · independent research.`),
        ]
      ),
      span({ display: "flex", fontFamily: "JetBrainsMono", fontSize: 18, color: "rgba(236,232,224,0.5)", letterSpacing: 2.4, textTransform: "uppercase" }, "markview.ai/projects"),
    ]
  );
  const svg = await satori(root, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { background: "#0b0a0d" }).render().asPng();
  fs.writeFileSync(path.join(outDir, "_index.png"), png);
  okCount++;
} catch (err) {
  console.error(`✗ _index: ${err.message?.split("\n")[0] ?? err}`);
  errCount++;
}

console.log(`✓ OG images: ${okCount} ok, ${errCount} errors → ${path.relative(webRoot, outDir)}/`);
if (errCount) process.exitCode = 1;
