# Inline Annotation for Marked

Use ruby, interlinear glosses, and line marks in a Marked document. This
workspace pilot uses the shared v2 parser and HTML renderer. To try it from
the repository root, run `npm ci && npm run build`, then run this as ESM:

```js
import { Marked } from "marked";
import inlineAnnotation from "marked-inline-annotation";

const md = new Marked(inlineAnnotation());
console.log(md.parse("A [gloss]^^((semi-)formal artefact) beside **東京^^(とうきょう)**."));
```

The inline tokenizer consumes a complete annotation at the current cursor.
Marked handles surrounding emphasis, links, code, and raw HTML tags. Marked
also owns GFM table separators, so use a backslash before a slot-separating
pipe in a table cell. Use the bracketed form for bases with spaces or
Markdown punctuation. The abbreviated form recognizes words, ideographs,
and symbols such as emoji. Slot text is literal.

Pass core rendering options such as `spaceAlignment` or `inlineStyles` to
`inlineAnnotation()`. Applications using stylesheet rendering can import
`markdown-it-inline-annotation/styles.css`. The pilot targets Marked 18.2.1
and runs in the monorepo CI.
