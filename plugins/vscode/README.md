# Inline Ruby Annotation for VS Code

Preview Inline Annotation syntax as ruby/furigana, over/under glosses, bouten,
overlines, and underlines in VS Code's built-in Markdown preview.

```markdown
[漢字]^^(かんじ)
[base]^^(over)^_(under)
[重要]^^(..)^_(.~)
```

The extension is a thin adapter: it installs
[`markdown-it-inline-annotation`](https://github.com/BaksiLi/markdown-it-inline-annotation)
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

```sh
npm install
npm run check
```

Inside the sibling-repo workspace, verify the adapter against an unpublished
core change with:

```sh
npm run check:local
```

The test suite runs the shared renderer corpus and the contiguous-source side
of the segment-boundary fixtures. Before publishing, update the lockfile to the
released core version and run the normal `npm run check` path again.

Pushing a `v<package-version>` tag runs the checks, packages the extension with
its core dependency, and uploads the VSIX to GitHub.
The Release workflow can be dispatched on the same tag to retry it.
Marketplace publishing also runs when repository variables `AZURE_CLIENT_ID`
and `AZURE_TENANT_ID` identify a federated Microsoft Entra application with
access to the `baksili` publisher.
Without that setup, the workflow explicitly reports that only the GitHub VSIX
was released.
See the [VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
for the publisher and federation setup.

## Ecosystem

- [Inline Annotation spec and core](https://github.com/BaksiLi/markdown-it-inline-annotation)
- [Inline Ruby Annotation for Obsidian](https://community.obsidian.md/plugins/inline-annotation)
- [Logseq reference plugin](https://github.com/BaksiLi/logseq-furigana-ruby)
- [Original proposal](https://blog.baksili.codes/markdown-ruby)

## Safety

The adapter injects no preview scripts. The shared renderer escapes
user-authored text before returning HTML to VS Code.

## License

MIT
