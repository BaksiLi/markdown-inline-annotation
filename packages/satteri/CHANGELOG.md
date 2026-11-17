# Changelog

## 0.8.0

- Move development and releases to the Inline Annotation monorepo.
- Preserve syntax v2, package names, and plugin IDs; use the shared 0.8.0 release line.

## 0.1.0

- Add a two-phase MDAST/HAST preset backed by
  `markdown-it-inline-annotation/core`.
- Run the shared HTML conformance corpus.
- Preserve link, code, raw-HTML, and MDX host boundaries.
- Normalize Sätteri `0.9` UTF-8 and `0.10` UTF-16 source positions before
  passing ranges to the JavaScript core.
