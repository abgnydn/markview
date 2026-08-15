# Media & references

Images, links, footnotes — the apparatus of a thoughtful document.

## Links

Inline link: visit the [MarkView repository](https://github.com/abgnydn/markview).

Bare URL: <https://markview.ai>

Reference style — useful when the same link appears in many places, or when you want the prose to read clean and put the URLs at the bottom: see [the CommonMark spec][cm] for canonical markdown, or [GitHub-flavored markdown][gfm] for the GFM extensions used here.

[cm]: https://spec.commonmark.org
[gfm]: https://github.github.com/gfm/

Anchor link to a heading earlier in this very file: [back to Links](#links).

## Footnotes

Some claims need an asterisk[^1]. Others want a longer aside that doesn't belong inline[^prose]. Footnotes accumulate at the foot of the document; the reader chooses whether to follow.

[^1]: A footnote is a sidebar without the spatial commitment.
[^prose]: When an aside threatens to derail the paragraph it sits in, push it to the bottom of the page and let the reader pick whether to follow. The cost of a footnote is a glance; the cost of an interrupted sentence is a re-read.

## Images

Every MarkView atmosphere is a public-domain painting, and any of them renders inline just as well as a photo — here's one with a soft drop shadow and a centered italic caption beneath it:

![Katsushika Hokusai, "Fine Wind, Clear Morning" (Red Fuji)](/atmospheres/fuji-hokusai.webp)

*Katsushika Hokusai, "Fine Wind, Clear Morning" (c. 1831) — the woodblock print behind the Fuji atmosphere.*

A second image, this time a painted landscape:

![Vincent van Gogh, "Wheat Field with Cypresses"](/atmospheres/fields-vangogh.webp)

*Vincent van Gogh, "Wheat Field with Cypresses" (1889) — one of the canvases the Fields atmosphere drifts through.*

## Task lists

A checklist of the typographic moves that landed in this redesign:

- [x] Iowan Old Style as the primary body face
- [x] Drop cap on the first paragraph after every H1
- [x] Hanging open-quote glyph on blockquotes
- [x] Asterism (three dots) for `<hr>`
- [x] Small-caps mono labels above code blocks
- [x] Focus-paragraph mode in the editor
- [ ] Margin sidenotes for footnotes (Tufte-style)
- [ ] Sepia toggle for late-night reading

## HTML escape hatch

Sometimes you need the underlying tag — <kbd>⌘</kbd>+<kbd>K</kbd> opens search, <kbd>Esc</kbd> closes any open overlay.

Subscript and superscript: H<sub>2</sub>O, x<sup>2</sup>, E = mc<sup>2</sup>.

A definition list using HTML, since markdown doesn't have one natively:

<dl>
  <dt>Lede</dt>
  <dd>The first paragraph after a headline. Carries the voice.</dd>
  <dt>Asterism</dt>
  <dd>Three dots used as a soft section break.</dd>
  <dt>Drop cap</dt>
  <dd>An oversized first letter that hangs into a paragraph.</dd>
</dl>

## Smart quotes

Markdown can render typography correctly: "double quotes" should curl, 'singles' too, and em-dashes — like this — should hang. Ellipses … should be a single glyph, not three dots. The apostrophe in *can't* should be a typographer's apostrophe.
