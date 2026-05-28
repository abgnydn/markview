// SPDX-License-Identifier: Apache-2.0
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

// Lazy-load route surfaces so the initial bundle is small.
// The editor pulls in CodeMirror, Shiki, Mermaid, KaTeX — none of which
// should land until the user is actually on /.
const Home = lazy(() => import("./routes/Home"));
const Privacy = lazy(() => import("./routes/Privacy"));
const Terms = lazy(() => import("./routes/Terms"));
const Projects = lazy(() => import("./routes/Projects"));
const Project = lazy(() => import("./routes/Project"));

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
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/p/:slug" element={<Project />} />
      </Routes>
    </Suspense>
  );
}
