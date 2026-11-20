# Install in an Obsidian Vault

From the monorepo root, install dependencies and build the shared core.

```sh
npm ci
npm run build --workspace packages/markdown-it
npm run check --workspace plugins/obsidian
```

For Plugin Lab, sync the examples into the existing `Inline Annotation`
folder alongside the plugin build.

```sh
npm run install:vault --workspace plugins/obsidian -- "/path/to/Plugin Lab" --examples-dir "Inline Annotation"
```

For another vault, pass `--examples` to install both notes at its root and
`--enable` to add the plugin to the community plugin list.

```sh
npm run install:vault --workspace plugins/obsidian -- "/path/to/Vault" --enable --examples
```

For repeat installs, set `OBSIDIAN_VAULT` to the target path and omit the
positional path argument.

The installer copies only:

- `main.js`
- `manifest.json`
- `versions.json`
- `styles.css`

It installs to:

```text
<vault>/.obsidian/plugins/inline-annotation/
```

Then reload Obsidian, or disable and re-enable **Inline Annotation** in
Community plugins.

If the plugin appears unchanged after reinstalling, verify that Obsidian is
opening the same vault path and that the installed directory is:

```text
<vault>/.obsidian/plugins/inline-annotation/
```

## Current Scope

- Reading view: supported
- Live Preview: early prototype
- Source mode: shows original Markdown source
- Links: skipped so anchors are not broken
- Space-based per-character alignment: conservative auto mode preserves
  multi-word glosses while aligning phonetic readings
- Markdown inside annotation text, such as `[term]^^(**bold gloss**)`: not
  supported

Use Reading view for smoke testing.

For focused test notes, pass `--examples` to copy:

- `inline-annotation smoke.md`
- `inline-annotation showcase.md`

Open them in Reading view and Live Preview after reloading the plugin.

If ruby text appears too small for your Obsidian zoom/theme, add a CSS snippet:

```css
body {
  --ia-rt-font-size: 0.65em;
}
```
