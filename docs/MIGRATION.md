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
`BaksiLi/markdown-inline-annotation-migration`, an archived migration snapshot rather than
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

## Publisher setup

Both registries can trust this repository's GitHub Actions workflow directly:

| Service | Existing identity | Trusted repository | Workflow |
| --- | --- | --- | --- |
| npm | `markdown-it-inline-annotation` | `BaksiLi/markdown-inline-annotation` | `release.yml` |
| VS Code Marketplace | publisher `baksili` | `BaksiLi/markdown-inline-annotation` | `release.yml` |

For npm, complete `npm login` using the maintainer account, then update the
package's trusted publisher:

```sh
npm trust github markdown-it-inline-annotation --file release.yml --repo BaksiLi/markdown-inline-annotation --allow-publish --yes
```

For Marketplace, open **Manage Publishers**, select the existing `baksili`
publisher, then add a GitHub policy under **Trusted Publishing** using the
repository and workflow above. The release job uses `vsce publish --oidc` with
`id-token: write`. This does not require an Azure app registration, tenant
variables, or a stored access token. See the official
[Marketplace publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publishing-extensions)
and [npm trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/).

The [Logseq directory PR](https://github.com/logseq/marketplace/pull/965) changes
only the existing entry's repository field. Keep the old Logseq repository
available until that PR and the generated catalog have switched over.

For the Obsidian directory admin, the handover request is:

> Please update the existing `inline-annotation` listing from
> `baksili/obsidian-inline-annotation` to `BaksiLi/markdown-inline-annotation`.
> This is a rename of the same GitHub repository, ID `1254119943`; the plugin
> ID, original releases, stars, and community history are preserved.
> Root `manifest.json` and `versions.json` remain available, and release
> `0.8.2` provides `main.js`, `manifest.json`, and `styles.css` under its
> matching bare semver tag. The old metadata and download URLs have been
> verified to reach the same current files. Please preserve the existing
> listing and download history.

The directory request above is prepared for the maintainer to send; it has not
been sent to Discord.

### Maintainer handover queue

These account-dependent steps are deferred until the maintainer is available.

| Item | Current evidence | Remaining action |
| --- | --- | --- |
| npm | Public latest is `0.4.0`; local account lookup returns `E401`; `0.8.2` is available as a GitHub tarball | Complete maintainer login, change the package's trusted publisher to the monorepo, then resume `0.8.2` |
| VS Code Marketplace | GitHub provides the `0.8.2` VSIX; Marketplace publication has not completed | Configure the existing `baksili` publisher's GitHub Trusted Publishing policy, then resume the same VSIX |
| Obsidian directory | The old repository URL redirects to the original repository and verified `0.8.2` metadata/assets | Send the prepared request to a directory admin to update the canonical repository name |
| Logseq directory | PR `logseq/marketplace#965` is ready for review; the generated catalog still names the old repository | Wait for upstream review and catalog update, verify updates, then archive the old Logseq repository |
| Old source repositories | Migration notices are present; the temporary migration snapshot is archived | Archive the remaining source repositories after their corresponding publishing or update-channel handover is verified |

After the account steps, the release resume command in the root README reuses
the original public artifacts. The code, packaging, and GitHub release do not
need to be recreated.

## Daily workflow

Use the root npm workspace and lockfile. The original standalone repositories are
historical snapshots, not additional development branches. Change the syntax contract
and shared corpus in the root, then update the integrations in the same change.

`npm run release:prepare -- patch|minor|major` synchronizes every version and dependency,
Obsidian mirrors, and the lockfile. Review `RELEASE_NOTES.md`, commit, and push the matching
tag. CI and release use the same validation and packaging commands.
