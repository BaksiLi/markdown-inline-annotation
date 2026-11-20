# Changelog

## 0.8.5

- Use the faster shared parser in Markdown preview while preserving the
  host's code and link boundaries.

## 0.8.4

- Resolve shared core types from workspace source before the core is built,
  with a separate configuration for emitted extension files.
- Keep TypeScript build configurations out of the published VSIX.

## 0.8.0

- Move development and releases to the Inline Annotation monorepo.
- Preserve syntax v2, package names, and plugin IDs; use the shared 0.8.0 release line.

## 0.4.0

- Track the v2 balanced-parenthesis revision in
  `markdown-it-inline-annotation@0.4.0`, preserving full parenthetical glosses
  in Markdown preview.
- **Source compatibility:** escape standalone left parentheses to preserve
  earlier first-close splits; old converter output that escaped only right
  parentheses needs natural balanced pairs or both sides escaped.
- Add automated CI and tag-based VSIX packaging and GitHub releases.

## 0.3.3

- Validate all shared segment-boundary cases as contiguous Markdown source,
  documenting that rich-text run policy belongs to DOM/rich-text adapters.
- Track `markdown-it-inline-annotation@0.3.3`.

## 0.3.2

- Track `markdown-it-inline-annotation@0.3.2`.
- Preserve independent overline/underline styles for chained line marks in
  Markdown preview.

## 0.3.1

- Track `markdown-it-inline-annotation@0.3.1`.
- Keep the adapter thin: preview rendering continues to come from the shared
  markdown-it plugin and fixture corpus.
- Teach the preview test runner to honor fixture taxonomy and skip cases that
  cannot run with adapter defaults.

## 0.3.0

- Track `markdown-it-inline-annotation@0.3.0`.
- Validate the preview adapter against the shared source-range fixture corpus,
  including extra pipe overflow behavior.

## 0.2.0

- Track Inline Annotation v2 via `markdown-it-inline-annotation@0.2.0`.
- Adds preview support for symmetric overline marks and visible pipe-overflow
  text through the shared renderer.

## 0.1.0

- Initial preview-only VS Code adapter.
- Renders Inline Annotation syntax through VS Code's Markdown preview
  `extendMarkdownIt` hook.
- Does not inject preview scripts or external resources.
