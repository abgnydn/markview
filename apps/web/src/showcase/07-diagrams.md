# Diagrams

Mermaid renders inline. Diagrams live next to the prose that argues for them — they're paragraphs in another language, not appendices.

## Flowchart

The basic editing loop: open a file, read it, drop into the editor, save, return to reading.

```mermaid
flowchart LR
  open[Open file] --> render[Render markdown]
  render --> view[Read on paper]
  view -->|press E| edit[Open editor]
  edit -->|⌘S| save[Save to disk]
  edit -->|Esc| view
  save --> render
```

## Sequence

What happens between you, the editor, and the disk when you save a file:

```mermaid
sequenceDiagram
  participant U as You
  participant E as Editor
  participant D as Disk

  U->>E: Press E
  E-->>U: Show CodeMirror overlay
  U->>E: Type
  E->>D: Buffer in memory
  U->>E: ⌘S
  E->>D: Write file
  D-->>E: Saved
  E-->>U: Editor closes
```

## State

The reading / editing / sharing states of a single file:

```mermaid
stateDiagram-v2
  [*] --> Reading
  Reading --> Editing: E
  Editing --> Reading: Esc
  Editing --> Saving: ⌘S
  Saving --> Reading
  Reading --> Sharing: Share button
  Sharing --> Reading: Close
  Sharing --> Editing: Co-edit
```

## Class

The data model that backs a workspace:

```mermaid
classDiagram
  class Workspace {
    +String id
    +String name
    +Date createdAt
    +addFile(filename, content)
    +removeFile(id)
  }

  class File {
    +String id
    +String filename
    +String content
    +Date modifiedAt
  }

  class CollabSession {
    +String roomId
    +Set~Peer~ peers
    +YDoc ydoc
    +start()
    +stop()
  }

  Workspace "1" o-- "*" File
  Workspace "1" o-- "0..1" CollabSession
```

## Gantt

A small project plan, the sort of thing a markdown editor handles natively:

```mermaid
gantt
  title MarkView v0.2 plan
  dateFormat YYYY-MM-DD
  section Editor
    Focus-paragraph mode   :done, 2026-05-25, 1d
    Typewriter scroll      :active, 2026-05-26, 3d
    Margin sidenotes       :2026-05-29, 4d
  section Theme
    Light/paper overhaul   :done, 2026-05-25, 1d
    Sepia variant          :2026-05-30, 2d
  section Desktop
    Code signing           :2026-06-01, 5d
    Auto-update            :2026-06-06, 4d
```

## Pie

A rough split of where time goes in a markdown app:

```mermaid
pie title Where the milliseconds go
  "Parse markdown" : 22
  "Syntax-highlight code" : 31
  "Render math" : 14
  "Mermaid diagrams" : 18
  "DOM commit" : 15
```
