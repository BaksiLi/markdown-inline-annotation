# Inline Ruby Annotation for VS Code

Preview-only VS Code adapter for `[base]^^(ruby)` Inline Annotation syntax:
ruby/furigana, interlinear glosses, bouten emphasis dots, overlines, and
underlines.

This extension uses VS Code's built-in Markdown preview hook and installs the
standard `markdown-it-inline-annotation` plugin through `extendMarkdownIt`.

Part of the Inline Annotation ecosystem:

- **Spec and core:** [`markdown-it-inline-annotation`](https://github.com/BaksiLi/markdown-it-inline-annotation)
- **Obsidian adapter:** [Inline Ruby Annotation](https://community.obsidian.md/plugins/inline-annotation)
- **Logseq reference plugin:** [`logseq-furigana-ruby`](https://github.com/BaksiLi/logseq-furigana-ruby)

## Scope

- Markdown preview rendering: yes
- Markdown source editing behavior: no
- hover, diagnostics, completion, and code actions: no
- preview scripts: no
- external resources: no

The first version is intentionally only a Markdown preview adapter. It proves
that Inline Annotation can travel as ordinary Markdown syntax without depending
on a host-specific browser script.

## Development

```sh
npm install
npm test
```

Inside this workspace, `npm run check:local` verifies the adapter against the
sibling `../markdown-it-inline-annotation` build and shared fixture corpus
without publishing a package first.

Before publishing this extension, publish `markdown-it-inline-annotation`
`0.3.2` or newer and run the normal install/test path.

## Safety Model

The adapter does not inject preview scripts. User-authored base and annotation
text is escaped by `markdown-it-inline-annotation` before generated HTML is
returned to VS Code's Markdown preview.

Keep editor-side features out of this package until preview rendering has real
usage feedback.
