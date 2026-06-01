# Changelog

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
