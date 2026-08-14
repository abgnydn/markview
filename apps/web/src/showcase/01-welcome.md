# A markdown editor that stays

On your machine. Drag a file in, drop a folder, paste a GitHub URL — MarkView renders it locally and never sends a byte. No accounts, no telemetry, no cloud storage.

This document is a tour. The sidebar on the left holds the rest of the showcase — typography, code, math, tables, callouts, diagrams, media, and live blocks. Press `\` for the graph view, `⌘K` to search across every file (flip it to **meaning** mode and it searches by sense, not spelling), `E` to open the editor on whichever file you're reading.

## What it does

- **Renders** GitHub-flavored markdown with Shiki for code, KaTeX for math, Mermaid for diagrams — plus live blocks: charts, tabs, timelines, CSV tables, maps, embeds
- **Edits** with CodeMirror 6 — focus-paragraph mode dims everything but the line you're on
- **Connects** your notes — `[[wikilinks]]`, backlinks, transclusion, a semantic related-notes rail, and a force-directed graph
- **Shares** through WebRTC — one URL, real-time collab, zero server; guests read along live
- **Exports** to PDF, Word, PowerPoint, PNG, SVG, HTML, reStructuredText, AsciiDoc, a zip, or a whole static site

## Try this

Every trigger below works right now, on this document:

- Press `E` — the **editor** opens on this file. Inside it, type `/` for block templates, `[[` to link another note, `#` for tags, and select text for a floating format bubble. `⌘S` saves — and every save keeps a snapshot you can restore from the clock icon.
- Press `P` — this document becomes a **presentation** (arrow keys advance, `?` shows every deck shortcut — there are thirty, including a laser pointer, spotlight, freehand draw, and a presenter window).
- Press `⌘P` — the **command palette**: jump to any file, switch workspaces, themes, atmospheres.
- Press `⌘J` — **chat with this workspace**: ask questions, get answers with citations. It runs entirely on your machine — SmolLM2 downloads ~220 MB into your browser once, and nothing you write ever leaves it.
- Select any sentence and press `⌘⇧A` — it becomes a **highlight** with an optional note. `⌘⇧C` copies a deep link straight to the selection.
- The tiny dots bottom-left switch on an **atmosphere** — the page becomes a living painting with ambient sound. Click the painting for an echo pulse, press `V` for volumetric mode, `G` for anaglyph 3D. The footprints icon walks you *into* it.
- Drag a file from the sidebar onto a workspace tab up top to **move it between workspaces**; double-click a file's name to **rename** it.
- **Export** lives under the `⋮` menu in the toolbar — as do split view, diff between files, the file browser, and version history.

## Power moves

`F` hides all chrome · `↑` `↓` walk the file list · `1`–`9` switch workspaces · `⌘+` / `⌘−` resize type · `/` opens search from anywhere · `Esc` always closes the topmost thing. Hold `⌘` a moment and the interface reveals its own shortcut badges.

## How it feels

The chrome lives on the edges. The toolbar reveals when you brush the top of the viewport; the file tree appears when you reach for the left edge; the table of contents arrives from the right. Everything inside is your text.

> [!quote]
> What is written without effort is in general read without pleasure.

## A taste of the rest

The next file in the sidebar walks through **typography** — every heading level, list style, drop cap, asterism break. After that, **code** demonstrates the syntax highlighter across TypeScript, Python, Rust, and shell. Then **math** for KaTeX, **tables** for data, **callouts** for asides, **diagrams** for Mermaid, **media** for images, links, and footnotes — and **blocks**, where fences turn into charts, tabs, timelines, maps, and embeds.

Click any file in the sidebar to jump in. Or just keep scrolling.
