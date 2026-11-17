# Monorepo migration

The unified repository is `BaksiLi/markdown-inline-annotation`. Syntax stays v2.
All products use the 0.8.2 release line; public package and plugin identities are unchanged.
Sätteri remains an unpublished pilot.

## Repository continuity

The monorepo continues the existing `BaksiLi/obsidian-inline-annotation` GitHub
repository (repository ID `1254119943`), renamed to `markdown-inline-annotation`.
Its stars, issues, original release tags, and published Obsidian assets stay with
the same repository. The already prepared monorepo history is merged into that
repository without replacing its history.

The short-lived new repository is retained as
`BaksiLi/markdown-inline-annotation-migration`, a migration snapshot rather than
a second development home. The 0.8.0 and 0.8.1 release attempts remained
unpublished drafts; 0.8.2 is the first unified release.

## History

Imported with unsquashed Git subtrees, preserving the original commit objects:

| Original repository | New path | Imported HEAD |
| --- | --- | --- |
| markdown-it-inline-annotation | packages/markdown-it | 9a033039cf889795198a51342f60f6a9e98142ea |
| logseq-furigana-ruby | plugins/logseq | 484ccb5cc464dd76a738ec5986acef40742aec78 |
| obsidian-inline-annotation | plugins/obsidian | 87de2666d41301d522e353976fb65999a4246068 |
| vscode-inline-annotation | plugins/vscode | 57f95226da1f84099460edf6da34b713d2d8100c |
| satteri-inline-annotation | packages/satteri | 80d92fbfe34fcb4f4926935e93f26d3521642407 |

Old release tags are retained as `history/markdown-it/*`, `history/logseq/*`,
`history/obsidian/*`, and `history/vscode/*` to avoid version-tag collisions.

## Update channels

- npm keeps `markdown-it-inline-annotation` and all documented exports. Its trusted publisher must point to this repository's `release.yml`.
- Obsidian keeps `inline-annotation`. Root `manifest.json` and `versions.json` are generated mirrors of the plugin metadata. Releases use a bare semver tag with `main.js`, `manifest.json`, and `styles.css` assets.
- Logseq keeps `logseq-furigana-ruby` and `_baksili_logseq-furigana-ruby`. Each release includes `logseq-furigana-ruby.zip`; the root icon serves the marketplace listing.
- VS Code keeps publisher `baksili` and extension name `vscode-inline-annotation`. The VSIX includes the real core runtime rather than workspace symlinks.

The former Obsidian repository is the monorepo itself and must not be archived.
Its old URL redirects to the same repository; do not recreate a repository under
that old name, which would replace the redirect. The Obsidian directory should
still be updated to the canonical name, and its update URLs must be verified.
The Logseq directory entry must point to the monorepo before archiving its former
update endpoint. GitHub archive mode prevents future releases;
archived repositories cannot act as ongoing release mirrors. Historical releases remain
available for older installations. `npm run release:status` checks the live entries.

Neither integration requires its own source repository. Obsidian requires its manifest
at the repository root and assets under the matching version tag. Logseq selects the
first `.zip` release asset and reads plugin metadata inside that archive; it does not
need the monorepo's root package to be a Logseq plugin. Its updater merges the current
marketplace manifest over installed metadata, allowing a directory repository change
to take effect for existing installations.

For Obsidian, changing the linked repository currently requires a directory admin;
the official FAQ directs maintainers to `#community-directory` on Discord. For Logseq,
change only `packages/logseq-furigana-ruby/manifest.json` in `logseq/marketplace`,
preserving the directory name and all existing IDs. Generated `plugins.json` is not edited.

## Daily workflow

Use the root npm workspace and lockfile. The original standalone repositories are
historical snapshots, not additional development branches. Change the syntax contract
and shared corpus in the root, then update the integrations in the same change.

`npm run release:prepare -- patch|minor|major` synchronizes every version and dependency,
Obsidian mirrors, and the lockfile. Review `RELEASE_NOTES.md`, commit, and push the matching
tag. CI and release use the same validation and packaging commands.
