---
title: Architecture Overview
category: Technical
---

# 🏗️ Architecture Overview

MarkView is built as a **privacy-first**, client-side application. All processing happens in the browser — your files never touch a server.

## System Architecture

```mermaid
flowchart TB
    subgraph Browser["🌐 Browser"]
        subgraph UI["UI Layer"]
            LP[Landing Page]
            TV[Toolbar + Theme]
            SB[Sidebar + File Tree]
            MR[Markdown Renderer]
            TOC[Table of Contents]
        end

        subgraph Core["Core Engine"]
            PP[Rendering Pipeline]
            SH[Shiki Highlighter]
            MM[Mermaid Renderer]
            KT[KaTeX Math]
            FM[Frontmatter Parser]
        end

        subgraph Storage["Storage Layer"]
            IDB[(IndexedDB)]
            LS[LocalStorage]
        end

        UI --> Core
        Core --> Storage
    end

    subgraph External["External"]
        GH[GitHub API]
        MCP[MCP Server]
    end

    LP -->|GitHub Import| GH
    MCP -->|Read/Search| IDB
```

## Data Flow

```mermaid
sequenceDiagram
    participant F as File Input
    participant S as Store
    participant DB as IndexedDB
    participant R as Renderer
    participant V as Viewer

    F->>S: Add files
    S->>DB: Persist workspace
    S->>R: Render active file
    R->>R: Parse frontmatter
    R->>R: Convert MD → HTML
    R->>R: Highlight code (Shiki)
    R->>R: Render diagrams (Mermaid)
    R->>R: Render math (KaTeX)
    R->>V: Display HTML
    V->>V: Extract headings → TOC
    V->>V: Validate inter-doc links
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 | App Router, SSR, API routes |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| State | Zustand | Lightweight state management |
| Storage | Dexie (IndexedDB) | Persistent file storage |
| Markdown | Unified + Remark + Rehype | Rendering pipeline |
| Highlighting | Shiki | Syntax highlighting |
| Diagrams | Mermaid | Flowcharts, sequences, etc. |
| Math | KaTeX | LaTeX formula rendering |
| AI | MCP Protocol | 15 tools for AI assistants |

## Component Tree

```mermaid
graph TD
    A["HomePage"] --> B["LandingPage"]
    A --> C["Toolbar"]
    A --> D["WorkspaceTabs"]
    A --> E["Sidebar"]
    A --> F["MarkdownRenderer"]
    A --> G["TableOfContents"]
    A --> H["SearchDialog"]
    A --> I["PresentationMode"]
    A --> J["SplitView"]
    A --> K["DiffView"]
    A --> L["MarkdownEditor"]
    F --> F1["Shiki Highlighter"]
    F --> F2["Mermaid Renderer"]
    F --> F3["KaTeX Renderer"]
    F --> F4["Link Validator"]
```

---

← Back to [Welcome](welcome.md)
