# Live blocks

A fence doesn't have to hold code. Give it the right language tag and it becomes an interface: a chart, a tabbed pane, a timeline, a map. Everything on this page is plain text in the source — press `E` to see for yourself, or type `/` in the editor to insert any of these as a template.

## Chart

One `Label: number` per line. That's the whole format.

```chart
Prose: 62
Code: 21
Math: 9
Diagrams: 8
```

## Tabs

Sections split on `---`; the first line of each section names its tab.

```tabs
macOS
brew install --cask abgnydn/tap/markview
---
Windows
Download the .msi from GitHub Releases → More info → Run anyway.
---
Linux
Grab the .AppImage, chmod +x, run.
```

## Timeline

`Date: text` lines become a vertical timeline.

```timeline
2024: The first commit — a single-file markdown previewer.
2025: Workspaces, presentations, and the editor grow in.
2026: Atmospheres, P2P collab, AI chat, desktop builds.
```

## CSV

Paste raw CSV, get a styled table with a row/column count.

```csv
format,extension,direction
Markdown,.md,in and out
Word,.docx,out
PowerPoint,.pptx,out
reStructuredText,.rst,out
```

## Map

Coordinates in, OpenStreetMap out.

```map
lat: 35.3606
lng: 138.7274
label: Mount Fuji — the atmosphere you may be looking at right now
```

## Embed

One URL per line. YouTube, Figma, CodePen, CodeSandbox, Loom, GitHub Gists, Spotify — each becomes its player; anything else gets a sandboxed frame.

```embed
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## Alerts as fences

The blockquote form (`> [!NOTE]`) works everywhere; the fence form takes a severity on its first line.

```alert
TIP
Type `/` in the editor — every block on this page is two keystrokes away.
```

## Connected notes

Inline extras: ==highlighted text==, superscript^2^, subscript~n~, and :sparkles: emoji shortcodes. Type `[[` and a filename to link a note — like this live one: [[02-typography]] (hover it for a preview) — or embed a whole section of another file:

![[04-math#Inline]]

That block above lives in the math document; edit it there and it changes here.
