# Tables

Hairlines only — no zebra stripes, no boxed cells. Columns lead the eye; the seams stay out of the way.

## Plan comparison

| Feature              | Local notes  | Cloud notes  | MarkView     |
| -------------------- | ------------ | ------------ | ------------ |
| Files on your disk   | yes          | no           | yes          |
| Real-time collab     | no           | yes          | yes          |
| Works offline        | yes          | partial      | yes          |
| Vendor lock-in       | none         | high         | none         |
| Markdown export      | trivial      | painful      | native       |
| Open format          | yes          | proprietary  | yes          |

## Performance log

| Run | Bundle (kB) | First paint (ms) | Notes                       |
| --: | ----------: | ---------------: | --------------------------- |
|  01 |       1432  |              184 | Vite baseline               |
|  02 |       1287  |              162 | Lazy-load Shiki             |
|  03 |       1093  |              141 | Drop Mermaid eager import   |
|  04 |        947  |              122 | Move y-webrtc to lazy chunk |
|  05 |        903  |              118 | Tree-shake unused languages |

## Alignment

| Left-aligned | Centered   | Right-aligned |
| :----------- | :--------: | ------------: |
| filename     | size       |          edit |
| welcome.md   | 1.4 KB     |     yesterday |
| typography.md| 2.1 KB     |      just now |
| code.md      | 3.7 KB     |      just now |

## Long content

| Term           | Definition                                                                            |
| -------------- | ------------------------------------------------------------------------------------- |
| **Lede**       | The first paragraph after a headline — sets the voice and frames the argument.        |
| **Asterism**   | A typographic ornament (⁂ or three dots ···) used to mark a soft section break.       |
| **Drop cap**   | An oversized first letter that hangs into a paragraph, traditionally three lines tall.|
| **Hanging quote** | A blockquote whose opening glyph sits in the gutter rather than inside the column. |
| **Typewriter mode** | Editor behavior where the active line stays centered in the viewport as you type. |

## With code in cells

| Shortcut    | Action                          |
| ----------- | ------------------------------- |
| `⌘K`        | Open search across all files    |
| `⌘B`        | Bold the selection              |
| `⌘I`        | Italicize the selection         |
| `⌘S`        | Save the current file           |
| `E`         | Open the editor on this file    |
| `Esc`       | Close the editor / dismiss UI   |
| `\`         | Toggle the graph view           |
