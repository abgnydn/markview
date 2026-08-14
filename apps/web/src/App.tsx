// SPDX-License-Identifier: Apache-2.0
import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { lazyWithRetry } from "./lib/lazy-with-retry";
import { ErrorBoundary } from "./components/error-boundary";

// Lazy-load route surfaces so the initial bundle is small.
// The editor pulls in CodeMirror, Shiki, Mermaid, KaTeX — none of which
// should land until the user is actually on /.
// Home is static: it is the always-hit route, and with the collab stack
// now lazy inside collab-store the landing costs ~20 KB gz here — cheaper
// than the extra round trip + "loading…" flash the lazy() split caused on
// every cold visit. Marketing/legal routes stay lazy.
import Home from "./routes/Home";
const Privacy = lazyWithRetry(() => import("./routes/Privacy"));
const Terms = lazyWithRetry(() => import("./routes/Terms"));
const Projects = lazyWithRetry(() => import("./routes/Projects"));
const Project = lazyWithRetry(() => import("./routes/Project"));
const ProjectsConstellation = lazyWithRetry(() => import("./routes/ProjectsConstellation"));

function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted, rgba(148,163,184,0.6))",
        fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
        fontSize: 13,
      }}
    >
      loading…
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary label="route">
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/3d" element={<ProjectsConstellation />} />
          <Route path="/p/:slug" element={<Project />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
