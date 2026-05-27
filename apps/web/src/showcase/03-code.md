# Code

The mono is Berkeley Mono with JetBrains Mono as a fallback. Inline code reads as a different texture from prose; block code reads as a quiet box with a small-caps language label above. Shiki handles the syntax highlighting, locally — no network round-trip.

## Inline code

The `useEffect` hook fires after render. Reach for it when you need a side-effect like `document.title = title` or `fetch('/api/foo')`. A common pair: `<span>` for inline, `<div>` for block. Variables `count`, `setCount`, `userId` all read clearly inline.

## TypeScript

```typescript
import { useEffect, useState } from 'react';

type Tab = 'edit' | 'preview' | 'split';

interface EditorProps {
  initial: string;
  onSave: (text: string) => void;
}

export function MarkdownEditor({ initial, onSave }: EditorProps) {
  const [text, setText] = useState(initial);
  const [tab, setTab] = useState<Tab>('split');

  useEffect(() => {
    document.title = text.split('\n')[0]?.replace(/^#\s*/, '') || 'Untitled';
  }, [text]);

  const handleSave = () => {
    onSave(text);
  };

  return (
    <div className={`editor editor-mode-${tab}`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

## Python

```python
from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class Note:
    title: str
    body: str
    tags: tuple[str, ...] = ()

    def render(self) -> str:
        meta = " ".join(f"#{t}" for t in self.tags)
        return f"# {self.title}\n\n{self.body}\n\n{meta}\n"


def filter_by_tag(notes: Iterable[Note], tag: str) -> list[Note]:
    """Return only the notes carrying the given tag."""
    return [n for n in notes if tag in n.tags]


if __name__ == "__main__":
    notes = [
        Note("Hello", "First note", ("intro", "writing")),
        Note("World", "Second note", ("writing",)),
    ]
    for n in filter_by_tag(notes, "writing"):
        print(n.render())
```

## Rust

```rust
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Workspace {
    pub name: String,
    pub files: HashMap<String, String>,
}

impl Workspace {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            files: HashMap::new(),
        }
    }

    pub fn add(&mut self, filename: &str, content: impl Into<String>) {
        self.files.insert(filename.into(), content.into());
    }

    pub fn words(&self) -> usize {
        self.files.values().map(|c| c.split_whitespace().count()).sum()
    }
}

fn main() {
    let mut ws = Workspace::new("notes");
    ws.add("hello.md", "# Hello\n\nFirst note.");
    println!("{} words across {} files", ws.words(), ws.files.len());
}
```

## Shell

```bash
# Bootstrap the dev server
bun install
bun --filter @markview/web run dev

# Build the desktop app for your platform
cd apps/desktop
bun run tauri build

# Run only TS-checks across the workspace
bun --filter '*' run typecheck
```

## Diff

```diff
- A markdown editor that stays
+ A beautiful markdown editor that stays
  on your machine. Drag a file in, drop a folder,
- paste a GitHub URL.
+ paste a GitHub URL — MarkView renders it locally.
```

## SQL

```sql
SELECT
  workspace.name,
  COUNT(file.id) AS file_count,
  SUM(LENGTH(file.content)) AS total_chars
FROM workspace
JOIN file ON file.workspace_id = workspace.id
WHERE workspace.archived_at IS NULL
GROUP BY workspace.name
ORDER BY total_chars DESC
LIMIT 10;
```

## A long line for wrapping

```typescript
const veryLongIdentifier = await fetch('/api/workspaces/' + workspace.id + '/files?include=content&format=json&since=' + lastSyncedAt.toISOString()).then((r) => r.json());
```
