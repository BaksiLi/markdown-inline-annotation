# Monorepo migration

The unified repository is `BaksiLi/markdown-inline-annotation`. Syntax stays v2.
Public package and plugin identities are unchanged. Sätteri remains an
unpublished pilot.

## Repository continuity

The monorepo continues the original `BaksiLi/obsidian-inline-annotation`
repository (repository ID `1254119943`), renamed to `markdown-inline-annotation`.
Its stars, issues, original release tags, published Obsidian releases, and
download history stay with the same repository. The prepared monorepo history
was merged into it without replacing its history.

Do not recreate a repository under the old name: GitHub would stop redirecting
the old URL, which older installations and the legacy Obsidian index still use.
The former Obsidian repository is the monorepo itself and must not be archived.

The 0.8.0 and 0.8.1 release attempts remained unpublished drafts; 0.8.2 is the
first unified release.

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

| Channel | Identity | Release input |
| --- | --- | --- |
| npm | `markdown-it-inline-annotation`, all documented exports | Tarball from the tagged workflow, published with provenance |
| Obsidian | ID `inline-annotation`, display name **Inline Annotation (Ruby)** | Root `manifest.json` and `versions.json` (generated mirrors); `main.js`, `manifest.json`, `styles.css` under the bare semver tag |
| Logseq | `logseq-furigana-ruby`, `_baksili_logseq-furigana-ruby` | `logseq-furigana-ruby.zip`; the root icon serves the marketplace listing |
| VS Code | publisher `baksili`, extension `vscode-inline-annotation` | VSIX containing the real core runtime, not workspace symlinks |

No integration needs its own source repository. Obsidian reads its manifest from
the repository root and assets from the matching version tag; the official
directory scans each new GitHub release automatically. Logseq takes the first
`.zip` release asset and reads plugin metadata inside it; its updater merges the
current marketplace manifest over installed metadata, so a directory repository
change reaches existing installations.

The Obsidian display name comes from the released `manifest.json`. The
[manifest reference](https://docs.obsidian.md/Reference/Manifest#name) permits
renaming while the ID stays fixed. Directory descriptions, categories, icon, and
screenshots are edited on the
[management page](https://community.obsidian.md/account/plugins/inline-annotation)
and persist across releases.

Run `npm run release:status` for the live state of every channel.

## Publisher setup

Both registries trust this repository's GitHub Actions workflow directly; no
stored token or Azure application is used.

| Service | Existing identity | Trusted repository | Workflow |
| --- | --- | --- | --- |
| npm | `markdown-it-inline-annotation` | `BaksiLi/markdown-inline-annotation` | `release.yml` |
| VS Code Marketplace | publisher `baksili` | `BaksiLi/markdown-inline-annotation` | `release.yml` |

For npm, the trusted publisher has no environment and explicitly allows direct
`npm publish` (new policies otherwise default to staging only). The equivalent
CLI setup is:

```sh
npm trust github markdown-it-inline-annotation --file release.yml --repo BaksiLi/markdown-inline-annotation --allow-publish --yes
```

For Marketplace, the existing `baksili` publisher has a GitHub policy under
**Trusted Publishing**; the release job runs `vsce publish --oidc` with
`id-token: write`. See the
[Marketplace publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions)
and [npm trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/).

Both connections were completed and verified with 0.8.2: the registry tarball
and Marketplace VSIX are byte-for-byte identical to the GitHub release assets.

## Open handover items

- **Logseq directory:** [logseq/marketplace#965](https://github.com/logseq/marketplace/pull/965)
  changes only `packages/logseq-furigana-ruby/manifest.json`, preserving the
  directory name and IDs; generated `plugins.json` is not edited. Keep the old
  Logseq repository active until the PR merges and updates are verified, then
  archive it. GitHub archive mode would block its releases, so it cannot serve
  as an ongoing mirror.
- **Obsidian legacy index:** `obsidianmd/obsidian-releases` still names the old
  repository path, which redirects to this repository. The live directory
  already recognizes the canonical repository. If an admin change is wanted,
  the [official FAQ](https://docs.obsidian.md/community-directory/faq) routes
  it through `#community-directory` on Discord.
- **Logseq SDK advisory:** `@logseq/libs@0.0.17` ships a prebundled
  `dist/lsplugin.user.js` embedding DOMPurify `2.3.8` and lodash `4.17.21`.
  Dependency overrides cannot replace that code, and no official SDK release
  fixes it. Obsidian's bundle does not contain the SDK. This needs a supported
  SDK upgrade or a separately reviewed, reproducible rebuild.

## Obsidian review

The official scan covers the whole repository. In 0.8.3 the Logseq live
renderer builds only its allowed elements, classes, and fixed styles through
DOM operations, removing the flagged HTML assignments while keeping literal
source HTML and entities as text. The branch preview of that change reported no
errors. Remaining warnings are either intentional (the display-name change and
the umbrella README title), outside the Obsidian bundle (Sätteri and VS Code
types, the Logseq SDK), deliberate standard DOM use, or CSS `text-decoration`
support notes for hosts older than the plugin's minimum app version.

## Daily workflow

Use the root npm workspace and lockfile. Change the syntax contract and shared
corpus at the root, then update the integrations in the same change. Work on a
short-lived branch, let CI and (for Obsidian-facing changes) the directory's
**Review branch** preview run, merge to `main`, then tag.

`npm run release:prepare -- patch|minor|major` synchronizes every version and
dependency, the Obsidian mirrors, and the lockfile. Review `RELEASE_NOTES.md`,
commit, and push the matching bare semver tag. CI and release use the same
validation and packaging commands.

## Local workspace

The parent workspace keeps the monorepo as its only development checkout. The
five original repositories are preserved under `archive/standalone/` with their
Git histories, demos, and historical builds. Writing drafts are under `drafts/`;
promotional media and review evidence are under `release-artifacts/`.

The temporary `markdown-inline-annotation-migration` repository was audited on
November 18, 2026: no stars, forks, issues, pull requests, releases, or
dependent update channels, and no implementation history missing from this
repository. A complete Git mirror, its Actions artifacts and logs, and
repository metadata are preserved under `archive/migration-snapshot/`, after
which the remote repository was deleted.
