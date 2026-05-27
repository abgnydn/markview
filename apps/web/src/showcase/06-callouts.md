# Callouts & quotations

Inline notes, warnings, and quotes — borrowed from GitHub's alert syntax, dressed in serif.

## Blockquote

A regular blockquote uses a hanging open-quote glyph in the gutter, no box, no border:

> The best way to predict the future is to invent it.

Multi-paragraph:

> Code is a tool for thinking, and the tools we choose shape what we think.
>
> The editor matters. The font matters. The way the cursor moves matters more than any single feature.

Nested quote inside prose:

> When I write, I try to write the sentence I want to read. Sometimes I succeed; usually I have to read it a few times and rewrite it until I do.
> — Anonymous

## GitHub-style alerts

> [!note]
> Notes are for context. They expand on the surrounding prose without breaking its rhythm. Use them when a paragraph needs a margin gloss.

> [!tip]
> Tips offer a way forward — a shortcut, a keyboard binding, a habit worth adopting. Press `⌘K` from anywhere to search.

> [!important]
> Important blocks earn their attention by being rare. Use them once a chapter, never twice in a row. They're for things the reader genuinely cannot skip.

> [!warning]
> Warnings call out a sharp edge. They don't shout, but they're impossible to miss. Useful for data loss, irreversible actions, or non-obvious gotchas.

> [!caution]
> Cautions are the strongest — reserved for outright dangers. Treat them the way you treat the radiation symbol on a door.

## Pull quote

The `[!quote]` callout becomes a centered, magazine-style pull quote — the largest single voice on the page, set in italic with balanced wrapping.

> [!quote]
> Simplicity is the ultimate sophistication.

A longer pull quote, the kind you'd see in the middle of a feature spread:

> [!quote]
> A good editor disappears. The interface fades, the chrome retreats to the edges, and what's left is the page — paper, ink, and the slow shape of a thought taking form.

## Mixed

A piece of prose with an inline aside (`> [!note]`) and a closing pull quote.

> [!note]
> The asides on this page all use the same underlying syntax: a blockquote whose first line is `[!type]`. The renderer pulls that out as the callout kind and styles the rest as the body.
