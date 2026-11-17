# Releases

Use a short-lived branch for changes. Run CI and, for Obsidian-facing changes,
the official **Review branch** preview before merging to `main`.

## Prepare and publish

Run from the repository root, on `main` after merging:

```sh
npm run release:prepare -- patch
npm run check
npm run release:pack
```

Update `RELEASE_NOTES.md`, review the version and lockfile changes, and commit.
Then publish the **bare semver tag** printed by `release:prepare`:

```sh
release_version=$(node -p 'require("./package.json").version')
git tag "$release_version"
git push origin main "$release_version"
```

One tagged workflow checks every integration, packages once, and publishes the
same verified files. The bare tag supports Obsidian's exact-version lookup and
Logseq's latest-release discovery. Versions are synchronized across workspaces;
syntax revisions are specified separately.

GitHub assets, npm, and VS Code Marketplace publish in separate jobs. npm uses
a trusted publisher for `BaksiLi/markdown-inline-annotation`, workflow
`release.yml`. Marketplace uses GitHub OIDC with a Trusted Publishing policy on
the existing `baksili` publisher for the same repository and workflow. Both
connections are configured; no Azure application or stored publishing token
is needed. See [publisher setup](MIGRATION.md#publisher-setup).

## Verify

- Check every job in the tagged Release workflow.
- Download the GitHub assets and verify `SHA256SUMS`.
- Compare the npm tarball and Marketplace VSIX with their GitHub assets.
- Check the Obsidian directory's version, automated review, and enabled install
  button. Its scan may lag behind the GitHub release.
- Check the Logseq directory handover before archiving its original repository.

## Download counts

```sh
npm run release:status
```

The status command leads with total cross-platform downloads, then each
platform's own counter: Obsidian's official cumulative count; npm since first
publication and for the last
reported month; Marketplace downloads and installs separately; and Logseq ZIP
downloads across the old and current repositories. It also reports stars,
forks, and directory handover state.

The total adds those four cumulative download counters. The npm monthly
subtotal is already included; Marketplace installs use a separate metric.
Other GitHub assets are excluded because their platform counters are already
represented.

The README's **3.3k+ downloads** badge is a rounded-down snapshot from
2026-11-18:

| Platform | Cumulative downloads |
| --- | ---: |
| Obsidian | 1,094 |
| npm | 1,866 |
| VS Code | 299 |
| Logseq | 72 |
| **Total** | **3,331** |

The npm total reports through 2026-11-16. Run `release:status` for current
values; the badge is a dated snapshot.

The npm requests use non-overlapping periods of at most one year, so lifetime
counts stay within the API's per-request limit. Failed sources are reported
as unavailable, never zero; the total is marked partial with the number of
available sources, and the command exits with a failure status. Counts include
updates, repeats, and automation, and platforms refresh at different times.
The aggregate counts download events, not unique users.

Sources: [Obsidian statistics](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugin-stats.json),
[npm download API](https://github.com/npm/registry/blob/main/docs/download-counts.md),
[Marketplace](https://marketplace.visualstudio.com/items?itemName=baksili.vscode-inline-annotation),
and the GitHub release asset `download_count` fields.

## Retry

Missing authorization fails the relevant publishing job; the GitHub assets
remain available. After restoring authorization, resume from the original
public assets:

```sh
gh workflow run release.yml --ref main -f existing_release="$(node -p 'require("./package.json").version')"
```

This verifies the downloaded files against `SHA256SUMS`, GitHub asset digests,
and package metadata, then retries npm and Marketplace. It does not rebuild
artifacts or alter the existing GitHub release. Existing npm integrity and
GitHub asset hashes must match; changed content requires a new version.
