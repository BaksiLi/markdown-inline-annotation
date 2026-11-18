# satteri-inline-annotation

Sätteri adapter for [Inline Annotation](https://github.com/BaksiLi/markdown-inline-annotation/tree/main/packages/markdown-it):
visible ruby/furigana, over/under glosses, bouten, overlines, and underlines in
Markdown.

This package is a host adapter. The syntax, semantic model,
source ranges, canonical HTML, and conformance fixtures remain owned by
`markdown-it-inline-annotation`.

## Status

This remains a local integration pilot tested against Sätteri `0.9.5` (the first
Cogitatum consumer) and `0.10.5`. It is not published. Plain Markdown is
supported; MDX is deliberately preserved unchanged until the adapter can use a
safe literal-insertion contract across the supported Sätteri range.

## Local install

From a sibling consumer such as `cogitatum-dev`:

```bash
npm install ../md-inline-annotation/markdown-inline-annotation/packages/satteri
```

The package uses `markdown-it-inline-annotation/core` for all parsing and
rendering. Sätteri is a peer dependency.

## Usage

The adapter is a two-phase preset because Sätteri parses Markdown before MDAST
plugins run. Both arrays are required:

```js
import { satteri } from "@astrojs/markdown-satteri";
import satteriInlineAnnotation from "satteri-inline-annotation";

const inlineAnnotation = satteriInlineAnnotation({
  spaceAlignment: "auto",
});

export default {
  markdown: {
    processor: satteri({
      mdastPlugins: [
        ...inlineAnnotation.mdastPlugins,
        // Other source/AST plugins run after Inline Annotation.
      ],
      hastPlugins: [
        ...inlineAnnotation.hastPlugins,
      ],
    }),
  },
};
```

Put the MDAST phase before plugins that derive data from headings or paragraph
text. It replaces complete expressions with inert markers and reparses the
surrounding Markdown; the HAST phase replaces those markers with the core's
escaped canonical HTML. This is necessary for chains such as
`[base]^^(over)^_(under)`, because an ordinary post-parse text visitor sees
Sätteri's emphasis interpretation of `^_` too late.

By default the renderer emits inline styles. With `inlineStyles: false`, load
the shared stylesheet from `markdown-it-inline-annotation/styles.css` in the
consumer.

## Host boundaries

- Complete expressions in paragraphs and headings render, including those in
  list items and blockquotes.
- Surrounding emphasis is retained: `**[漢字]^^(かんじ)**` stays strong.
- Markdown-looking characters inside a base or slot remain plain text, as the
  specification requires.
- Inline code, links, images, raw-HTML islands, and MDX are not claimed by the
  adapter.
- GFM table cells are not transformed in `0.1.0`; their source ranges include
  row delimiters and require a separate inline-container strategy.

These are host policies, not alternate grammar. Add portable behavior to the
core fixture corpus first; keep Sätteri parser timing and container cases here.

## Development

```bash
npm install
npm test
npm run check --workspace packages/satteri
```

The test suite consumes the published fixture exports from
`markdown-it-inline-annotation`, then adds Sätteri-specific precedence and
host-boundary cases.

## License

MIT
