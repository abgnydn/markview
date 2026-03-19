# MarkView Technical Documentation

## 1. System Overview

MarkView is a modern, modular, and privacy-first markdown documentation viewer and editor. It is designed as a **local-first, peer-to-peer (P2P), headless CMS** that compiles across multiple targets (Web, Desktop, Chrome Extension, Node/CLI) while exposing its rendering engine as reusable packages for third-party developers.

### Core Principles
- **Local-First & Offline:** All files, state, and version history reside entirely within the browser's IndexedDB. No centralized cloud backend is required.
- **Privacy by Default:** Zero telemetry, no accounts, and all network activity is either P2P (WebRTC) or strictly client-to-AI (MCP).
- **Extensibility:** Provides a Model Context Protocol (MCP) server for AI assistants and standalone NPM packages (`@markview/core`, `@markview/react`, `@markview/webcomponent`).

---

## 2. Installation & Quick Start

MarkView can be embedded into any existing React project using our official SDK.

### Installing the React SDK

```bash
npm install @markview/react @markview/core
```

### Basic Implementation

Drop the `<MarkView>` component into your Next.js or React application to instantly parse Markdown, execute Mermaid code blocks, and render mathematical equations.

```tsx
import { MarkView } from '@markview/react';

const myDocs = `
# Hello Developers
MarkView automatically handles [GitHub-style alerts](https://github.com) and syntax highlighting.
`;

export default function App() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <MarkView content={myDocs} />
    </div>
  );
}
```

> **Note:** The React component automatically parses frontmatter and hydrates the built-in UI layout. For fully headless parsing, import from `@markview/core`.

---

## 2. Monorepo Architecture

The project is structured as a monorepo utilizing npm workspaces, separated into `apps` (production endpoints) and `packages` (reusable logic).

### Tech Stack
- **Framework:** Next.js 16 (React 19)
- **Styling:** Tailwind CSS (v4)
- **Native Wrapper:** Tauri v2 (Rust/WebKit)
- **State Management:** Zustand + Dexie.js (IndexedDB)
- **Collaboration:** Yjs + y-webrtc (WebRTC CRDTs)
- **Markdown Engine:** Custom pipeline using marked, Shiki (syntax), Mermaid (diagrams), KaTeX (math).

### Directory Structure

```text
markview/
├── apps/
│   ├── web/          # Core Next.js React Application
│   ├── desktop/      # Tauri v2 native wrapper for macOS
│   ├── extension/    # Chrome Extension (Sidepanel)
│   └── mcp/          # Model Context Protocol server exposing AI tools
├── packages/
│   ├── core/         # Pure TS markdown parsing and searching logic
│   ├── react/        # React component bindings for core
│   ├── webcomponent/ # Custom DOM elements for framework-agnostic usage
│   ├── eslint-config/# Shared linting rules
│   └── tsconfig/     # Shared TypeScript configurations
```

---

## 3. Storage & State Management

Application state is decoupled from the UI strictly using **Zustand** stores, with persistent data synced to **Dexie.js** (IndexedDB wrapper).

- **`workspace-store.ts`:** Manages the active workspace, file tree hierarchies, multi-tab routing, and drag-and-drop operations for sorting files. Data persists across reloads without a server.
- **`version-store.ts`:** Handles automatic snapshotting of document states upon saving. It enables a Git-like "revert" functionality completely client-side.
- **`theme-store.ts`:** Global theme configuration managing variables for curated palettes (e.g., Dracula, Nord, Monokai).
- **`annotation-store.ts`:** Maps DOM range selections to persistent highlights and notes within the IndexedDB on a per-file basis.
- **`collab-store.ts`:** Binds Yjs (CRDT) document states to the UI and establishes WebRTC signaling connections for real-time multiplayer updates.

---

## 4. Module Breakdown

### 4.1 apps/web (The Core UI)
This Next.js application serves as the flagship product. Key component subsystems include:

#### Viewer Subsystem (`src/components/viewer/`)
- **`markdown-renderer.tsx` & `markdown-editor.tsx`:** The core rendering surface. Utilizes a dual-mode approach where Shiki highlights the underlying WYSIWYG code, and Mermaid/KaTeX parse dynamic blocks.
- **`export-menu.tsx`:** A heavy client-side export pipeline. 
  - Generates `.docx` via `docx`.
  - Generates `.pptx` via `pptxgenjs`.
  - Generates PDFs via `html2pdf.js`.
  - Renders UI to images via `html-to-image`.
- **`diff-view.tsx` & `split-view.tsx`:** Complex layout managers for side-by-side file comparisons and multi-pane reading.
- **`presentation-mode.tsx`:** Dynamically slices markdown content at designated HTML heading tags (`<h1>`, `<h2>`) to generate a fullscreen slide deck view.

#### Workspace Subsystem (`src/components/workspace/`)
- **`github-import.tsx`:** Uses the GitHub API to fetch raw markdown files directly into the browser memory, bypassing the need for a server middleman.
- **`file-upload.tsx` & `workspace-tabs.tsx`:** Handles binary file dropping, parsing, and multi-tab state navigation.

#### Collaboration Subsystem (`src/components/collab/`)
- Manages P2P presence (`presence-bar.tsx`) and the room joining UI (`join-dialog.tsx`, `share-dialog.tsx`). All real-time cursors and document states are synced via WebRTC without touching a central database.

### 4.2 apps/mcp (The AI Protocol Server)
Built using the `@modelcontextprotocol/sdk` and `zod` schema validation, this Node CLI exposes 15 internal workspace capabilities to AI Assistants (like Cursor or Claude).
- Reads the local file system.
- Exposes structured data extractors: `get_headings`, `get_links`, `get_table`, `get_frontmatter`.
- Allows AI to execute write operations: `create_document`, `update_document`.

### 4.3 apps/desktop (Tauri macOS Wrapper)
- Replaces heavy Electron setups with Rust-based Tauri (`src-tauri`).
- Injects native OS integrations (e.g., setting the application as the default `.md` file handler in Finder).
- Configured strictly via `tauri.conf.json` utilizing the Next.js `out/` static export directory.

### 4.4 apps/extension (Chrome Extension)
- Uses Manifest V3.
- Skips traditional action popups in favor of Chrome's `sidepanel` API (`sidepanel/index.html`), allowing MarkView to dock permanently alongside standard web browsing.

---

## 5. Packages & Reusability (SDK)

The logic is successfully decoupled from Next.js to provide an SDK.

- **`@markview/core` (`packages/core/`)**:
  - `pipeline.ts`: The unified markdown compilation pipeline.
  - `search.ts`: Client-side full-text search indexing algorithms.
  - `frontmatter.ts`: Fast YAML extraction logic.
- **`@markview/react` (`packages/react/`)**:
  - Exposes `<MarkView content={markdown} />`. It bundles the core parser into a standard React lifecycle component, handling its own CSS isolation.
- **`@markview/webcomponent` (`packages/webcomponent/`)**:
  - Exposes standard DOM elements (`<mark-view>`). It allows developers using Vue, Svelte, Angular, or Vanilla HTML to utilize the rendering engine without pulling in React runtime dependencies.

---

## 6. Core Workflows Data Flow

### The Offline Save Workflow
1. User edits text in `markdown-editor.tsx`.
2. Component triggers action in `workspace-store.ts`.
3. Action serializes content and pushes to `Dexie.js` queue.
4. Concurrently, `version-store.ts` checks the last snapshot timestamp. If a threshold passes, it clones the new state to the Version History DB table.

### The P2P Collaboration Workflow
1. User clicks "Share" in `share-dialog.tsx`.
2. `collab-store.ts` initializes a new `Y.Doc`.
3. `y-webrtc` connects to a generic signaling server (e.g., `wss://signaling.yjs.dev`).
4. Remote user joins with the room hash.
5. WebRTC establishes a direct Peer-to-Peer connection.
6. Local document differences are merged using Yjs CRDT logic strictly between the two browsers.

### The Component Export Workflow
1. User clicks "Export PDF" in `export-menu.tsx`.
2. Code fetches the raw HTML from `markdown-renderer.tsx`.
3. `html2pdf.js` constructs an internal hidden canvas.
4. PDF is generated in memory and a blob URL is passed to `<a download="...">` for immediate user download.
