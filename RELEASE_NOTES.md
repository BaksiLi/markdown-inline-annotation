Inline Annotation **0.8.3** updates the Obsidian presentation and addresses
automated source-review findings in the shared repository.

- The Obsidian display name is **Inline Annotation (Ruby)**.
- The existing `inline-annotation` ID, Community listing, and update channel are
  preserved. Existing installations continue to use the same plugin.
- Keep the original cat icon and add native Obsidian screenshots, with
  repeatable source notes, to the guides.
- Preserve the original proposal link and Logseq showcase in the shared README.
- Build Logseq live-rendered annotations with explicit DOM operations. Literal
  HTML and entity-looking text beside an annotation stay text, rather than
  becoming elements or being decoded. Preserve the generated ruby, line styles,
  nesting, and host boundaries.
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
