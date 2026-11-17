Inline Annotation **0.8.3** refreshes the Obsidian presentation and resolves the
errors from the Obsidian directory's automated source review.

- Obsidian: the display name is now **Inline Annotation (Ruby)**. The
  `inline-annotation` ID, Community listing, download history, and update
  channel are unchanged, so existing installations simply update.
- Obsidian: the guide adds native screenshots of Reading view and Live Preview;
  the original cat icon is kept.
- Logseq: live-rendered annotations are built with explicit DOM operations.
  Literal HTML and entity-looking text beside an annotation stay text instead of
  becoming elements or being decoded. Ruby, line styles, nesting, and host
  boundaries render as before.
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
