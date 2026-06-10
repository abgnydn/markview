// SPDX-License-Identifier: Apache-2.0
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initTimeOfDayTint } from "@/lib/atmosphere/time-of-day";
import { initTauriBridge } from "@/lib/tauri/tauri-bridge";

initTimeOfDayTint();
// Wire the desktop file-open bridge (no-op in the browser / PWA).
void initTauriBridge();

import "./app/globals.css";
// KaTeX base styles — required for math glyph positioning to work.
import "katex/dist/katex.min.css";
// Zen layer — loaded AFTER globals so the override wins. Makes the
// editor feel like brain space: vanishing chrome, serif body, paper bg.
import "./styles/zen.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root missing in index.html");

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// Dev-only escape hatch: expose stores on window so browser-driven tests
// can seed a workspace without clicking through the UI.
if (import.meta.env.DEV) {
  void Promise.all([
    import("./stores/workspace-store"),
    import("./stores/theme-store"),
  ]).then(([ws, theme]) => {
    (window as unknown as { __mv: unknown }).__mv = {
      workspace: ws.useWorkspaceStore,
      theme: theme.useThemeStore,
    };
  });
}

// Register PWA service worker (lives in public/sw.js).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* silent: SW is best-effort offline cache */
    });
  });
}

// Pause ambient atmosphere animations when the tab is hidden — saves CPU /
// battery. The zen-modules CSS keys `body.mv-hidden` to animation-play-state.
if (typeof document !== "undefined") {
  const syncHidden = () => document.body.classList.toggle("mv-hidden", document.hidden);
  document.addEventListener("visibilitychange", syncHidden);
  syncHidden();
}
