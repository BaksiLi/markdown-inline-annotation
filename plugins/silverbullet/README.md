# Inline Annotation for SilverBullet

The SilverBullet trial adds ruby, glosses, and emphasis marks to Markdown notes
using the shared Inline Annotation parser and HTML renderer. The editor shows
the original markup when the cursor enters an annotation.

## Try the library

In a SilverBullet test space, run `Library: Install` and paste this URI:

```text
ghr:BaksiLi/markdown-inline-annotation@silverbullet-preview-1/silverbullet-library.md
```

Open `Library/BaksiLi/Inline Annotation` and follow the demo link. The Library
Manager installs the demo and the shared renderer with the library page.
Preview 1 accepts one level of parentheses inside a slot. The source build
below extends that to three.

For a manual install, extract the trial ZIP into a test space, keeping the
`Library/` path. For a space that's already open, run `Space: Reindex` and reload
the client to pick up the library.

To assemble the ZIP and the Library Manager assets from source, run this from
the repository root:

```sh
node plugins/silverbullet/pack-preview.mjs
```

The files land in `artifacts/silverbullet/`.

## Demo and scope

The [SilverBullet demo note](space/Library/BaksiLi/inline-annotation-demo.md) reuses
examples from the project's [Before/After page][before-after] and
[Obsidian showcase][obsidian-showcase]. The trial supports plain bracketed
bases with `^^(...)` or `^_(...)`, pipe-separated slots, opposite-side chains,
marks, backslash escapes, and up to three levels of parentheses inside a slot.
The first slot can render while a following opposite slot is incomplete. Kana and
phonetic readings can align per character. Ordinary multiword glosses stay
grouped. The same output is available through
`markdown.markdownToHtml(source, {expand = true})`.

Use standalone annotations in prose. Abbreviated forms and nested bracketed
bases are outside the trial grammar. Markdown link labels or unsupported
nested forms can still contain text that the delimiter hook treats as an inner
annotation. Pipe slots should be used outside Markdown tables.

For offline reloads on SilverBullet Server, add
`config.set("sync.documents", true)` in a `space-lua` block in `CONFIG` and
complete a sync while online. This setting syncs documents throughout the
space, including the library's JavaScript files. See [SilverBullet Sync].

The library uses [`syntax.define`](https://docs.silverbullet.md/API/syntax) to
bound source ranges for the common bracketed forms. A parser hook with access
to the full inline context would let the shared parser select ranges and
preserve Markdown structures for the full grammar.

[before-after]: ../../packages/markdown-it/examples/before-after.html
[obsidian-showcase]: ../obsidian/examples/obsidian-showcase.md
[SilverBullet Sync]: https://docs.silverbullet.md/Sync
