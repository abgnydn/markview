#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// generate-og-home.mjs — the main site Open Graph card (1200×630 PNG) at
// public/og-image.png, referenced by every page's <meta property="og:image">.
//
// Rendered via satori + resvg to match the per-project cards in
// generate-og-images.mjs (same dark gradient, fonts, accent). Features the
// real app icon (icon-512, the serif-M-on-paper mark) + current product
// pitch. This is a committed asset — run this script on demand when the
// branding/copy changes; it is NOT wired into the CI build (which must not
// mutate source `public/`).
//
//   bun run apps/web/scripts/generate-og-home.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const outPath = path.resolve(webRoot, "public/og-image.png");
const iconPath = path.resolve(webRoot, "public/icon-512.png");

const fontBold = fs.readFileSync(path.resolve(webRoot, "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff"));
const fontReg = fs.readFileSync(path.resolve(webRoot, "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff"));
const fontMono = fs.readFileSync(path.resolve(webRoot, "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff"));
const fonts = [
  { name: "Inter", data: fontBold, weight: 700, style: "normal" },
  { name: "Inter", data: fontReg, weight: 400, style: "normal" },
  { name: "JetBrainsMono", data: fontMono, weight: 400, style: "normal" },
];

const iconDataUri = `data:image/png;base64,${fs.readFileSync(iconPath).toString("base64")}`;

const div = (style, children) => ({ type: "div", props: { style, children } });
const span = (style, children) => ({ type: "span", props: { style, children } });

const ACCENT = "#9b7dff";
const INK = "#ece8e0";

const chips = ["LOCAL-FIRST", "WEB & DESKTOP", "REAL-TIME COLLAB", "ATMOSPHERES"].map((t) =>
  span(
    {
      display: "flex",
      marginRight: 12,
      padding: "8px 16px",
      border: `1px solid ${ACCENT}`,
      color: ACCENT,
      borderRadius: 4,
      fontSize: 19,
      fontFamily: "JetBrainsMono",
      letterSpacing: 2.4,
    },
    t,
  ),
);

const card = div(
  {
    width: 1200,
    height: 630,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "72px 80px",
    background: "linear-gradient(135deg, #0b0a0d 0%, #1a1525 100%)",
    color: INK,
    fontFamily: "Inter",
  },
  [
    // top row — domain
    span(
      { display: "flex", fontFamily: "JetBrainsMono", fontSize: 19, color: "rgba(236,232,224,0.5)", letterSpacing: 2.4 },
      "MARKVIEW.AI",
    ),
    // middle — icon + wordmark + tagline
    div({ display: "flex", alignItems: "center", marginTop: 6 }, [
      div({ display: "flex", marginRight: 44 }, [
        { type: "img", props: { src: iconDataUri, width: 200, height: 200 } },
      ]),
      div({ display: "flex", flexDirection: "column" }, [
        span({ display: "flex", fontSize: 104, fontWeight: 700, letterSpacing: -3, lineHeight: 1, color: INK }, "MarkView"),
        span(
          { display: "flex", marginTop: 20, fontSize: 32, lineHeight: 1.3, color: "rgba(236,232,224,0.82)", maxWidth: 720 },
          "A local-first markdown editor that reads like a painting.",
        ),
      ]),
    ]),
    // bottom — feature chips
    div({ display: "flex", flexWrap: "wrap" }, chips),
  ],
);

const svg = await satori(card, { width: 1200, height: 630, fonts });
const png = new Resvg(svg, { background: "#0b0a0d" }).render().asPng();
fs.writeFileSync(outPath, png);
console.log(`✓ wrote ${path.relative(webRoot, outPath)} (1200×630)`);
