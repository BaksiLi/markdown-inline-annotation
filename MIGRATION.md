# Inline Annotation has moved

New home: https://github.com/BaksiLi/markdown-inline-annotation

This integration now lives in `plugins/obsidian`. The original commit `87de2666d41301d522e353976fb65999a4246068` and all
historical release tags have been preserved in the new repository. Existing
package names, plugin IDs, and syntax v2 remain unchanged.

The official plugin directory still uses this repository as its update endpoint. It remains active until that entry has migrated; source development takes place only in the monorepo.

Please file new issues and pull requests in the monorepo. The original releases
remain available here. The new root README describes the single workspace and
release workflow; do not maintain a parallel source branch in this repository.

For current migration state, run `npm run release:status` in the new checkout.
