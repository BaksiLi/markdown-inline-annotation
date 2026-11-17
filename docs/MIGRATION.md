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
the [official FAQ](https://docs.obsidian.md/community-directory/faq) directs maintainers
to `#community-directory` on Discord. This is an administrative repository change,
not the normal release process. The existing GitHub redirect preserves the old metadata
and asset URLs. Separately, the public Community directory still showed `0.4.0` on
November 18, 2026; that listing has not yet been verified at `0.8.2`. The maintainer
can use **Check for new releases** on the directory entry's management page and inspect
its review results before asking an admin to change the canonical repository path.
For Logseq, change only `packages/logseq-furigana-ruby/manifest.json` in `logseq/marketplace`,
preserving the directory name and all existing IDs. Generated `plugins.json` is not edited.

## Publisher setup

Both registries can trust this repository's GitHub Actions workflow directly:

| Service | Existing identity | Trusted repository | Workflow |
| --- | --- | --- | --- |
| npm | `markdown-it-inline-annotation` | `BaksiLi/markdown-inline-annotation` | `release.yml` |
| VS Code Marketplace | publisher `baksili` | `BaksiLi/markdown-inline-annotation` | `release.yml` |

For npm, configure the package's trusted publisher in its npm settings using the
repository and workflow above. Leave the environment blank and explicitly allow
direct `npm publish`; newly created policies otherwise default to staging only.
The same setup is available through the CLI after maintainer login:

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
been sent to Discord. Include the public directory's `0.4.0` version if it still
has not discovered the public `0.8.2` release after checking from the management page.

### Maintainer handover queue

The maintainer completed both publisher connections on November 18, 2026
(Asia/Taipei). npm and Marketplace publishing are verified.

| Item | Current evidence | Remaining action |
| --- | --- | --- |
| npm | Public latest is `0.8.2`; the registry tarball is byte-for-byte identical to the original GitHub asset; a fresh registry install passed the core and markdown-it smoke checks | Complete |
| VS Code Marketplace | Public latest is `0.8.2`; the downloaded Marketplace VSIX is byte-for-byte identical to the original GitHub asset; the old VS Code source repository is archived with migration guidance | Complete |
| Obsidian directory | The old GitHub URLs reach verified `0.8.2` metadata/assets, but the public Community directory still displays `0.4.0` | Sign in to check for new releases and review results; ask a directory admin to update the canonical repository name |
| Logseq directory | PR `logseq/marketplace#965` is open and not a draft; its WIP app still reports an old draft status; the generated catalog still names the old repository | The draft/ready events were retriggered and the documented `@wip ready for review` body marker added; wait for the external check/review and catalog update, verify updates, then archive the old Logseq repository |
| Old source repositories | Migration notices are present; the temporary migration snapshot, old core, and old VS Code repositories are archived | Archive the old Logseq repository after its update-channel handover is verified |

After the account steps, the release resume command in the root README reuses
the original public artifacts. The code, packaging, and GitHub release do not
need to be recreated.

Earlier verification on November 18, 2026 (Asia/Taipei):
[full CI](https://github.com/BaksiLi/markdown-inline-annotation/actions/runs/44140612552)
passed. The [0.8.2 resume run](https://github.com/BaksiLi/markdown-inline-annotation/actions/runs/44140678700)
downloaded and verified the original public artifacts successfully; npm rejected
publishing authorization and Marketplace rejected the publisher token exchange.
The existing GitHub release was skipped and its files were not replaced.

The [latest 0.8.2 resume](https://github.com/BaksiLi/markdown-inline-annotation/actions/runs/44147828227)
verified the original artifacts and successfully submitted the VSIX using direct
GitHub OIDC. Marketplace initially reported `Verifying`, then public lookup
confirmed `0.8.2`. The downloaded Marketplace VSIX has SHA-256
`cc04299667c90bd0caef0b663408a7a8bef9d367f1fdee255dba871b5fe75086`,
identical to the original GitHub asset; extension and embedded core versions are
both `0.8.2`, and their repository metadata points to the monorepo. The old VS Code
repository was then archived, preserving its migration notice and historical releases.

npm rejected that resume with `E404`; the maintainer subsequently clarified that
the prepared connection had not yet been submitted. The tarball's repository URL,
workflow OIDC permission, and runner's Node/npm versions were checked and are correct.
All seven public GitHub asset IDs and digests remain unchanged.

After the maintainer submitted the npm connection, retrying only the failed npm
job completed the same release run successfully (attempt 2). Public npm latest
became `0.8.2`, with integrity
`sha512-YQh+ooaWwbtmvTUv1vArihgU0WCB9xyRT1vrf7g5BsweueozkfwFHBTYv6vDryx+vDoAXonlIx7vQuQgrkMImQ==`.
The downloaded registry tarball is identical to the original GitHub asset and has
provenance metadata. A clean temporary project installed the public package and
markdown-it from npm; both the standalone core and markdown-it adapter correctly
rendered `[artefact]^^((semi-)formal artefact)`. The old core repository was then
archived, retaining its migration guidance and historical releases.

## Daily workflow

Use the root npm workspace and lockfile. The original standalone repositories are
historical snapshots, not additional development branches. Change the syntax contract
and shared corpus in the root, then update the integrations in the same change.

`npm run release:prepare -- patch|minor|major` synchronizes every version and dependency,
Obsidian mirrors, and the lockfile. Review `RELEASE_NOTES.md`, commit, and push the matching
tag. CI and release use the same validation and packaging commands.

## Local workspace cleanup

The parent workspace now keeps the monorepo as its only development checkout.
The five original repositories are preserved under `archive/standalone/`, with
their Git histories, demos, and historical builds; only their ignored dependency
directories were removed. Original writing drafts are under `drafts/`, and
promotional media remain under `release-artifacts/`. The parent's README maps
these locations. The monorepo's full check passed after moving the old checkouts.

The temporary `markdown-inline-annotation-migration` repository was audited on
November 18, 2026. It has no stars, forks, issues, pull requests, or releases.
All implementation history is already in this monorepo; its only additional
commit, `a413156`, replaces the README with migration guidance. No plugin update
channel or publishing workflow depends on that temporary repository. A complete
Git mirror, all four Actions runs' artifacts, logs, and repository metadata are
preserved locally under `archive/migration-snapshot/`. The remote repository
remains archived; deletion has not been performed.
