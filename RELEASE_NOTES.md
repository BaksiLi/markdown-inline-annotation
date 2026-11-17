Inline Annotation now has one home: `BaksiLi/markdown-inline-annotation`.

- One workspace, lockfile, conformance corpus, and release workflow for all five integrations.
- The public npm, Logseq, Obsidian, and VS Code products share version **0.8.2**.
- The original Obsidian repository becomes the shared home, preserving its stars, issues, and historical releases.
- Existing npm package names, plugin IDs, and the dependency-free `/core` API are preserved.
- Syntax remains **v2**, including balanced annotation parentheses.
- Satteri remains a source-available pilot; this release does not publish it to npm.

Assets: npm tarball, `logseq-furigana-ruby.zip`, Obsidian `main.js` / `manifest.json` / `styles.css`,
VS Code VSIX, and `SHA256SUMS`. GitHub assets, npm publishing, and Marketplace publishing have
separate workflow jobs so publisher setup failures are visible and retryable.

Plugin directory entries may take time to migrate. Existing installations retain their IDs.
Use the old repository's migration notice for the current update-channel status.
