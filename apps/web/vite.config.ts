// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tauri reads from apps/web/out via `frontendDist` in tauri.conf.json.
// Keep the build output name in sync.
export default defineConfig({
  plugins: [react()],
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
