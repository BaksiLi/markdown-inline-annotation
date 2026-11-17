> Development and releases now live in the [Inline Annotation monorepo](https://github.com/BaksiLi/markdown-inline-annotation). This integration is maintained in `plugins/vscode`. Run workspace commands from the repository root; see the [root guide](../../README.md).

# Inline Ruby Annotation for VS Code

Preview Inline Annotation syntax as ruby/furigana, over/under glosses, bouten,
overlines, and underlines in VS Code's built-in Markdown preview.

```markdown
[漢字]^^(かんじ)
[base]^^(over)^_(under)
[重要]^^(..)^_(.~)
```

The extension is a thin adapter: it installs
[`markdown-it-inline-annotation`](https://github.com/BaksiLi/markdown-inline-annotation/tree/main/packages/markdown-it)
through VS Code's `extendMarkdownIt` hook.

## Scope

| Feature | Support |
| --- | --- |
| Built-in Markdown preview | yes |
| Source editor decorations | no |
| Hover, diagnostics, completion, code actions | no |
| Preview scripts or external resources | none |

VS Code provides one contiguous Markdown source stream, so rich-text run
boundaries do not apply here. Markdown-owned constructs such as escapes,
emphasis, strikethrough, links, code, HTML, and entities remain under
markdown-it's rules.

## Development

Run from the monorepo root:

```sh
npm ci
npm run build --workspace packages/markdown-it
npm run check --workspace plugins/vscode
```

The tests run the shared rendering and contiguous-source boundary corpora. The
root `release:pack` command stages a standalone core runtime and verifies the VSIX.
All products release together from a bare version tag; see the
[root release guide](../../README.md#release). Marketplace publishing uses GitHub
OIDC and a Trusted Publishing policy on the existing `baksili` publisher, naming
`BaksiLi/markdown-inline-annotation` and `release.yml`. Missing publisher
authorization fails the publishing job; GitHub still distributes the VSIX.

## Ecosystem

- [Inline Annotation spec and core](https://github.com/BaksiLi/markdown-inline-annotation/tree/main/packages/markdown-it)
- [Inline Ruby Annotation for Obsidian](https://community.obsidian.md/plugins/inline-annotation)
- [Logseq reference plugin](https://github.com/BaksiLi/markdown-inline-annotation/tree/main/plugins/logseq)
- [Original proposal](https://blog.baksili.codes/markdown-ruby)

## Safety

The adapter injects no preview scripts. The shared renderer escapes
user-authored text before returning HTML to VS Code.

## License

MIT
