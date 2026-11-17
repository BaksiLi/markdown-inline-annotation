Inline Annotation **0.8.4** improves editor integration checks, reduces
Obsidian source-review warnings, and makes release activity easier to see.

- Obsidian: annotation elements use the host's `createEl` helpers, keeping the
  owning document correct for popout windows. The display name remains
  **Inline Annotation (Ruby)**; the ID, listing, download history, cat icon,
  and update channel are preserved.
- Sätteri and VS Code: typechecks resolve the shared core directly from source,
  including in a clean checkout before the core is built. Separate build
  configurations keep emitted packages portable.
- `npm run release:status` now reports downloads across Obsidian, npm, VS Code,
  and both Logseq repositories, plus stars and directory handover state.
  Each metric keeps its platform definition and reporting period.
- The README keeps the original proposal, examples, and screenshots, adds live
  download badges, and moves release operations into a focused guide.
- Syntax remains **v2**, including balanced annotation parentheses. Public npm
  package names, Logseq IDs, and the VS Code publisher and extension ID stay
  unchanged.
- Satteri remains a source-available pilot; this release does not publish it to npm.

Assets: npm tarball, `logseq-furigana-ruby.zip`, Obsidian `main.js` / `manifest.json` / `styles.css`,
VS Code VSIX, and `SHA256SUMS`. GitHub assets, npm publishing, and Marketplace publishing have
separate workflow jobs so publisher setup failures are visible and retryable.

Logseq's directory change is awaiting review in `logseq/marketplace#965`.
Its original repository remains available until the update-channel handover
is verified.

Known review warning: Logseq's SDK still embeds outdated DOMPurify and lodash.
Obsidian does not bundle that SDK. Dependency overrides would not replace the
SDK's embedded code, so this release does not claim to resolve that separate
warning.
