Inline Annotation 0.8.5 keeps syntax v2 and improves rendering, Markdown
compatibility, and package verification across the supported hosts.

- Logseq keeps the host's text nodes attached so editing and rerendering a
  block can reconcile cleanly. Block menus convert between Markdown and
  representable Logseq macros. The plugin now includes Logseq SDK 0.3.6
  and its third-party notices.
- Obsidian preserves escaped pipes and line-mark glyphs in eligible Reading
  View paragraphs. Reading View and Live Preview preserve host-owned
  formatting and syntax boundaries.
- markdown-it and the VS Code preview avoid repeated scans on long malformed
  input. The core exports a shared DOM renderer and an exact slot classifier
  alongside its parser and HTML renderer.
- Marked and Sätteri use the shared core at their respective parsing
  boundaries. Sätteri's source ranges are verified against UTF-8 and UTF-16
  position formats. The Sätteri adapter remains a source-available pilot.
- The web demos and desktop showcase notes now share seven examples. CI
  checks the generated examples, tests the adapters, and verifies the
  packaged files in one command.

The release includes both npm tarballs, the Logseq ZIP, the Obsidian plugin
assets, the VS Code VSIX, and SHA-256 checksums. The Logseq Marketplace
entry now points to this repository.
