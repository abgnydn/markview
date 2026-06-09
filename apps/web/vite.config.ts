// SPDX-License-Identifier: Apache-2.0
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

// After the build, inject the real app-shell asset list into the service
// worker's precache so the app actually boots offline (the entry JS/CSS are
// content-hashed each build, so the list can't be hand-maintained). Lazy
// chunks stay runtime-cached on first use — precaching all of them would
// bloat the install — so this lists only the critical first-paint set.
function swPrecache(): Plugin {
  return {
    name: "sw-precache",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(__dirname, "out");
      const swPath = path.join(outDir, "sw.js");
      const htmlPath = path.join(outDir, "index.html");
      if (!fs.existsSync(swPath) || !fs.existsSync(htmlPath)) return;
      // The critical first-paint set is exactly what index.html references —
      // the entry script, its CSS, and any modulepreload. Globbing assets/
      // would wrongly sweep in every lazily-loaded chunk (Rollup names them
      // index-*.js too) and bloat the install.
      const html = fs.readFileSync(htmlPath, "utf8");
      const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
      const shell = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", ...new Set(refs)];
      const sw = fs
        .readFileSync(swPath, "utf8")
        .replace(/const STATIC_ASSETS = \[[\s\S]*?\];/, `const STATIC_ASSETS = ${JSON.stringify(shell)};`);
      fs.writeFileSync(swPath, sw);
      // eslint-disable-next-line no-console
      console.log(`[sw-precache] injected ${shell.length} app-shell assets into sw.js`);
    },
  };
}

// Tauri reads from apps/web/out via `frontendDist` in tauri.conf.json.
// Keep the build output name in sync.
export default defineConfig({
  plugins: [react(), swPrecache()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "out",
    target: "es2022",
    sourcemap: true,
  },
  server: {
    port: 3001,
    strictPort: true,
  },
  optimizeDeps: {
    // pdf.js + transformers.js ship large wasm/worker bundles — let Vite
    // pre-bundle them so the dev server doesn't choke on first request.
    exclude: ["pdfjs-dist", "@huggingface/transformers"],
  },
});
