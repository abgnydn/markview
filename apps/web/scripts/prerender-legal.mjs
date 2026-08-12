// Give /privacy and /terms their own crawlable head metadata.
//
// The SPA client-routes both pages, so before this a crawler hitting
// /privacy got the homepage shell with the homepage title — for a product
// whose entire pitch is privacy, the privacy policy deserves to be a
// first-class indexable URL. This copies the built index.html (which
// carries the full OG/JSON-LD block) and swaps the page-specific fields;
// the body still hydrates client-side, which Google renders fine — the
// title/canonical/description are what it won't infer.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(webRoot, "out");
const ORIGIN = "https://markview.ai";

const PAGES = [
  {
    route: "privacy",
    title: "Privacy Policy — MarkView",
    description:
      "MarkView is local-first by architecture: documents live in your browser, no accounts, no telemetry. The policy explains exactly which optional features talk to a network and why.",
  },
  {
    route: "terms",
    title: "Terms of Service — MarkView",
    description:
      "Terms of service for MarkView, the open-source local-first markdown editor (Apache-2.0).",
  },
];

const shell = readFileSync(path.join(outDir, "index.html"), "utf8");

for (const page of PAGES) {
  let html = shell;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`);
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*(")/,
    `$1${page.description}$2`,
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${ORIGIN}/${page.route}" />`,
  );
  html = html
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${page.title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${page.description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${ORIGIN}/${page.route}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${page.title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${page.description}$2`);

  const dir = path.join(outDir, page.route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), html);
  console.log(`✓ Prerendered head: /${page.route}`);
}
