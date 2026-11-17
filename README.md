# Inline Annotation

A Markdown syntax for ruby, furigana, bouten, line marks, and two-slot annotations.
The specification, parser, shared conformance corpus, and editor integrations live here.

```markdown
[漢字]^^(かんじ)
[李太白]^^(Lǐ Tài Bái|ㄌㄧˇ ㄊㄞˋ ㄅㄞˊ)
[（半）形式的產物]^^((semi-)formal artefact)
```

The syntax is **v2**. Product versions follow one release line, currently **0.8.0**.

## Specification and integrations

- [Specification](SPEC.md) and [shared fixtures](fixtures/).
- [Parser, dependency-free core, and markdown-it plugin](packages/markdown-it/).
- [Logseq plugin](plugins/logseq/) — marketplace ID `logseq-furigana-ruby`.
- [Obsidian plugin](plugins/obsidian/) — plugin ID `inline-annotation`.
- [VS Code extension](plugins/vscode/) — `baksili.vscode-inline-annotation`.
- [Sätteri adapter](packages/satteri/) — pilot, not published to npm.
- [Adapter contract and compatibility](docs/ADAPTERS.md).

The npm package remains `markdown-it-inline-annotation`. Its `/core`, fixture, stylesheet,
CommonJS, ES module, and type exports are preserved. No package reinstall or plugin-ID
migration is needed solely because the source repositories moved.

## Develop

Use Node.js 24 and npm. All commands run from this directory.

```sh
npm ci
npm run build
npm test
npm run check
npm run release:pack
```

`check` runs all five integrations and package checks. `release:pack` then creates and
verifies the npm tarball, Logseq ZIP, Obsidian assets, VSIX, and checksums in `artifacts/`.
It needs `zip` and `unzip`, available on macOS and the Linux CI runner.

Run a single integration with `npm run test --workspace plugins/logseq`, for example.
Build `packages/markdown-it` first when working directly on a dependent workspace.

`SPEC.md`, `fixtures/`, and `docs/` are canonical. The parser build copies them into its
ignored publication directory; Logseq reads the canonical fixtures directly.

## Release

```sh
npm run release:prepare -- patch
npm run check
npm run release:pack
# Review and commit the version, lockfile, and RELEASE_NOTES.md.
git tag 0.8.1
git push origin main 0.8.1
```

Use the version printed by `release:prepare` as the **bare semver tag**. One tagged workflow
checks every integration, packages once, and publishes the same verified files. The bare
tag supports Obsidian's exact-version lookup and Logseq's latest-release discovery.
Versions are synchronized across workspaces; syntax revisions are specified separately.

GitHub assets, npm, and VS Code Marketplace publish in separate jobs. npm requires a
trusted publisher for `BaksiLi/markdown-inline-annotation`, workflow `release.yml`.
Marketplace requires federated publisher access and the repository variables
`AZURE_CLIENT_ID` and `AZURE_TENANT_ID`; without them, the job explicitly reports that
Marketplace was not published. The GitHub VSIX is still available.

Workflow retries verify existing npm integrity and GitHub asset hashes before accepting
an already published version. Changed content requires a new version.

## Repository migration

All five original histories are retained as ancestors. Old tags are namespaced under
`history/<integration>/...`; [migration details](docs/MIGRATION.md) record the source commits
and update-channel handover. The old repositories retain their historical releases and
receive migration notices. Plugin update endpoints remain active until their directory
entries have moved. Use `npm run release:status` to inspect the live handover state.

[MIT license](LICENSE).
